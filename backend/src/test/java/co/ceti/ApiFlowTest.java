package co.ceti;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.request;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

/**
 * Flujos extremo a extremo contra Postgres real. Cubre la matriz de autorización que antes
 * probaba testFirestoreRules: aislamiento de tenant, gate de atestación (Ley 1581), finanzas
 * self-only, validación de forma y supresión.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
@Import(TestcontainersConfiguration.class)
class ApiFlowTest {

  @Autowired MockMvc mvc;
  @Autowired JsonMapper json;
  @Autowired JdbcClient jdbc;

  record Res(int status, JsonNode body) {}

  Res call(HttpMethod method, String path, String token, Object body) throws Exception {
    var req = request(method, path).contentType(MediaType.APPLICATION_JSON);
    if (token != null) req.header("Authorization", "Bearer " + token);
    if (body != null) req.content(body instanceof String s ? s : json.writeValueAsString(body));
    MvcResult r = mvc.perform(req).andReturn();
    String text = r.getResponse().getContentAsString();
    return new Res(r.getResponse().getStatus(), text.isEmpty() ? null : json.readTree(text));
  }

  String login(String email) throws Exception {
    Res r = call(HttpMethod.POST, "/api/auth/dev", null, json.createObjectNode().put("email", email).put("name", email));
    assertThat(r.status()).isEqualTo(200);
    return r.body().get("token").asString();
  }

  String movimiento(String id, String categoria) {
    return """
        {"id":"%s","tipo":"gasto","monto":5000,"descripcion":"almuerzo","categoria":"%s",
         "origen":"manual","fecha":1760000000000,"createdAt":1760000000000,"updatedAt":1760000000000}
        """.formatted(id, categoria);
  }

  @Test
  void flujoCompletoProfesorEstudiante() throws Exception {
    assertThat(call(HttpMethod.GET, "/api/me", null, null).status()).isEqualTo(401);

    // Profesor auto-registrado → colegio propio aislado.
    String profe = login("profe@colegio.test");
    Res access = call(HttpMethod.POST, "/api/me/access", profe, "{\"requestedRole\":\"profesor\"}");
    assertThat(access.body().get("role").asString()).isEqualTo("profesor");
    String cid = access.body().get("colegioId").asString();

    Res curso = call(HttpMethod.POST, "/api/cursos", profe, "{\"nombre\":\"9A\",\"grado\":\"9\"}");
    assertThat(curso.status()).isEqualTo(200);
    String cursoId = curso.body().get("cursoId").asString();
    String code = curso.body().get("code").asString();
    String base = "/api/colegios/" + cid + "/cursos/" + cursoId;

    // Estudiante: invitado → se une por código → pendiente de atestación.
    String est = login("est@colegio.test");
    assertThat(call(HttpMethod.POST, "/api/me/access", est, null).body().get("role").asString()).isEqualTo("estudiante");
    assertThat(call(HttpMethod.POST, "/api/me/join", est, "{\"code\":\"" + code.toLowerCase() + "\"}").status()).isEqualTo(200);
    JsonNode me = call(HttpMethod.GET, "/api/me", est, null).body();
    String uid = me.get("id").asString();
    assertThat(me.get("cursoId").asString()).isEqualTo(cursoId);

    // Un profesor no puede degradarse uniéndose como estudiante.
    assertThat(call(HttpMethod.POST, "/api/me/join", profe, "{\"code\":\"" + code + "\"}").status()).isEqualTo(412);

    // Pendiente: ve su propio estado, pero no genera datos del curso.
    Res slot = call(HttpMethod.GET, base + "/estudiantes/" + uid, est, null);
    assertThat(slot.body().get("estado").asString()).isEqualTo("pendiente_atestacion");
    String progress = """
        {"colegioId":"%s","cursoId":"%s","uid":"%s","competencia":"ahorro","mastery":0.9,
         "quizScores":{},"completed":true,"updatedAt":1}
        """.formatted(cid, cursoId, uid);
    assertThat(call(HttpMethod.PUT, base + "/estudiantes/" + uid + "/progress/world_1", est, progress).status()).isEqualTo(403);

    // Otro profesor (otro colegio) no ve el roster.
    String intruso = login("intruso@otro.test");
    call(HttpMethod.POST, "/api/me/access", intruso, "{\"requestedRole\":\"profesor\"}");
    assertThat(call(HttpMethod.GET, base + "/estudiantes", intruso, null).status()).isEqualTo(403);

    // Atestación → activo → escribe progreso; el profesor lo ve y el agregado no es nominal.
    assertThat(call(HttpMethod.POST, base + "/estudiantes/" + uid + "/atestacion", profe,
        "{\"atestado\":true,\"politicaVersion\":\"v1\"}").status()).isEqualTo(200);
    assertThat(call(HttpMethod.PUT, base + "/estudiantes/" + uid + "/progress/world_1", est, progress).status()).isEqualTo(204);
    assertThat(call(HttpMethod.PUT, base + "/estudiantes/" + uid + "/progress/world_1", est,
        progress.replace("\"mastery\":0.9", "\"mastery\":1.5")).status()).isEqualTo(400);
    Res list = call(HttpMethod.GET, base + "/estudiantes/" + uid + "/progress", profe, null);
    assertThat(list.body().get(0).get("worldId").asString()).isEqualTo("world_1");
    JsonNode agregado = call(HttpMethod.GET, base + "/agregado", profe, null).body();
    assertThat(agregado.get("estudiantesActivos").asInt()).isEqualTo(1);
    assertThat(agregado.toString()).doesNotContain(uid).doesNotContain("est@colegio.test");

    // Config de clase: solo el profesor, y el autor debe ser quien escribe.
    String config = "{\"mundos\":[{\"worldId\":\"world_1\",\"activo\":true}],\"version\":1,\"updatedAt\":1,\"updatedByUid\":\"%s\"}";
    String profeId = call(HttpMethod.GET, "/api/me", profe, null).body().get("id").asString();
    assertThat(call(HttpMethod.PUT, base + "/config", profe, config.formatted("otro")).status()).isEqualTo(400);
    assertThat(call(HttpMethod.PUT, base + "/config", profe, config.formatted(profeId)).status()).isEqualTo(200);
    assertThat(call(HttpMethod.PUT, base + "/config", est, config.formatted(uid)).status()).isEqualTo(403);
    assertThat(call(HttpMethod.GET, base + "/config", est, null).status()).isEqualTo(200);

    // Reto: solo los tipos permitidos en v1.
    String reto = """
        {"kind":"reto","reto":{"tipo":"%s","cantidad":3},"target":{"tipo":"curso","cursoId":"%s"},
         "fechaInicio":1,"deadline":2,"createdByUid":"%s","createdAt":1}
        """;
    assertThat(call(HttpMethod.POST, "/api/colegios/" + cid + "/asignaciones", profe,
        reto.formatted("cumplir_tope", cursoId, profeId)).status()).isEqualTo(400);
    assertThat(call(HttpMethod.POST, "/api/colegios/" + cid + "/asignaciones", profe,
        reto.formatted("crear_meta", cursoId, profeId)).status()).isEqualTo(200);
    assertThat(call(HttpMethod.GET, base + "/asignaciones", est, null).body().size()).isEqualTo(1);

    // Diario: forma estricta y self-only.
    assertThat(call(HttpMethod.PUT, "/api/me/movimientos/m1", est, movimiento("m1", "comida")).status()).isEqualTo(204);
    assertThat(call(HttpMethod.PUT, "/api/me/movimientos/m2", est, movimiento("m2", "casino")).status()).isEqualTo(400);
    assertThat(call(HttpMethod.PUT, "/api/me/movimientos/m3", est,
        movimiento("m3", "comida").replace("\"origen\"", "\"extra\":1,\"origen\"")).status()).isEqualTo(400);
    assertThat(call(HttpMethod.GET, "/api/me/finanzas", est, null).body().get("movimientos").size()).isEqualTo(1);
    assertThat(call(HttpMethod.GET, "/api/me/finanzas", profe, null).body().get("movimientos").size()).isZero();

    // Supresión (Ley 1581): borra datos, marca el slot y revoca el acceso al instante.
    assertThat(call(HttpMethod.POST, base + "/estudiantes/" + uid + "/supresion", intruso, null).status()).isEqualTo(403);
    assertThat(call(HttpMethod.POST, base + "/estudiantes/" + uid + "/supresion", profe, null).status()).isEqualTo(200);
    assertThat(call(HttpMethod.GET, "/api/me/finanzas", est, null).body().get("movimientos").size()).isZero();
    assertThat(call(HttpMethod.GET, "/api/me", est, null).body().get("role").isNull()).isTrue();
    assertThat(call(HttpMethod.GET, base + "/estudiantes/" + uid, profe, null).body().get("estado").asString()).isEqualTo("suprimido");
    assertThat(call(HttpMethod.GET, base + "/estudiantes/" + uid + "/progress", profe, null).body().size()).isZero();
  }

  @Test
  void contenidoGlobalRequiereSesion() throws Exception {
    assertThat(call(HttpMethod.GET, "/api/content/bancos/10_world_1_multiple_choice", null, null).status()).isEqualTo(401);
    String t = login("lector@colegio.test");
    Res banco = call(HttpMethod.GET, "/api/content/bancos/10_world_1_multiple_choice", t, null);
    assertThat(banco.status()).isEqualTo(200);
    assertThat(banco.body().get("items").size()).isGreaterThan(0);
    assertThat(call(HttpMethod.GET, "/api/content/microteoria/10_world_1", t, null).status()).isEqualTo(200);
    assertThat(call(HttpMethod.GET, "/api/content/bancos/no_existe", t, null).status()).isEqualTo(404);
  }

  @Test
  void adminPorAllowlist() throws Exception {
    String admin = login("juandiegodiazave@gmail.com");
    assertThat(call(HttpMethod.POST, "/api/me/access", admin, null).body().get("role").asString()).isEqualTo("admin");
    assertThat(call(HttpMethod.POST, "/api/admin/colegios", admin, "{\"colegioId\":\"demo\",\"nombre\":\"Demo\"}").status()).isEqualTo(200);
    assertThat(call(HttpMethod.POST, "/api/admin/colegios", admin, "{\"colegioId\":\"demo\",\"nombre\":\"Demo\"}").status()).isEqualTo(409);
    assertThat(call(HttpMethod.GET, "/api/admin/colegios", admin, null).body().get("colegios").size()).isGreaterThanOrEqualTo(1);
    String otro = login("nadie@colegio.test");
    assertThat(call(HttpMethod.GET, "/api/admin/colegios", otro, null).status()).isEqualTo(403);
  }

  @Test
  void asistenteFinancieroSoloEstudianteYConCupo() throws Exception {
    String body = "{\"text\":\"gasté 5000 en almuerzo\",\"requestId\":\"r1\",\"context\":{\"goals\":[],\"movements\":[],\"operations\":[]}}";
    String profe = login("profe-ia@colegio.test");
    call(HttpMethod.POST, "/api/me/access", profe, "{\"requestedRole\":\"profesor\"}");
    assertThat(call(HttpMethod.POST, "/api/ia/plan-financiero", profe, body).status()).isEqualTo(403);

    // Cupo agotado: se rechaza ANTES de llamar al modelo (la key de test nunca sale a la red).
    String est = login("est-ia@colegio.test");
    call(HttpMethod.POST, "/api/me/access", est, null);
    String uid = call(HttpMethod.GET, "/api/me", est, null).body().get("id").asString();
    jdbc.sql("insert into ia_usage (user_id, kind, day, count) values (?, 'asistente', (now() at time zone 'utc')::date, 100)")
        .param(uid)
        .update();
    Res r = call(HttpMethod.POST, "/api/ia/plan-financiero", est, body);
    assertThat(r.status()).isEqualTo(429);
    assertThat(r.body().get("code").asString()).isEqualTo("resource-exhausted");
  }
}
