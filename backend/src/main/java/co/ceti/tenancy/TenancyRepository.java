package co.ceti.tenancy;

import java.sql.Array;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Timestamp;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

@Repository
public class TenancyRepository {

  public record ColegioRow(String id, String nombre, String plan, Integer planMaxEstudiantes) {}

  public record CursoRef(String colegioId, String cursoId) {}

  private final JdbcClient jdbc;

  public TenancyRepository(JdbcClient jdbc) {
    this.jdbc = jdbc;
  }

  // ---- colegios ----

  public boolean colegioExists(String id) {
    return jdbc.sql("select count(*) from colegios where id = ?").param(id).query(Long.class).single() > 0;
  }

  public void insertColegio(String id, String nombre, String plan, Integer planMax, String createdBy) {
    jdbc.sql(
            """
            insert into colegios (id, nombre, plan, plan_max_estudiantes, created_by)
            values (?, ?, ?, ?, ?)
            """)
        .params(id, nombre, plan, planMax, createdBy)
        .update();
  }

  public List<ColegioRow> listColegios() {
    return jdbc.sql("select id, nombre, plan, plan_max_estudiantes from colegios order by nombre")
        .query(
            (rs, i) ->
                new ColegioRow(
                    rs.getString("id"),
                    rs.getString("nombre"),
                    rs.getString("plan"),
                    (Integer) rs.getObject("plan_max_estudiantes")))
        .list();
  }

  public Optional<String> colegioNombre(String id) {
    return jdbc.sql("select nombre from colegios where id = ?").param(id).query(String.class).optional();
  }

  // ---- cursos ----

  public Optional<Curso> findCurso(String cid, String cursoId) {
    return jdbc.sql("select * from cursos where colegio_id = ? and id = ?")
        .params(cid, cursoId)
        .query(this::mapCurso)
        .optional();
  }

  public List<Curso> cursosDeProfesor(String cid, String uid) {
    return jdbc.sql("select * from cursos where colegio_id = ? and ? = any(profesor_uids) order by created_at")
        .params(cid, uid)
        .query(this::mapCurso)
        .list();
  }

  public List<Curso> cursosDeColegio(String cid) {
    return jdbc.sql("select * from cursos where colegio_id = ? order by created_at").param(cid).query(this::mapCurso).list();
  }

  public void insertCurso(String cid, String id, String nombre, String grado, List<String> profesorUids, String codigo, String createdBy) {
    jdbc.sql(
            """
            insert into cursos (colegio_id, id, nombre, grado, profesor_uids, codigo, created_by)
            values (:cid, :id, :nombre, :grado, string_to_array(:profes, ','), :codigo, :createdBy)
            """)
        .params(
            Map.of(
                "cid", cid,
                "id", id,
                "nombre", nombre,
                "grado", grado,
                "profes", String.join(",", profesorUids),
                "codigo", codigo,
                "createdBy", createdBy))
        .update();
  }

  public void setCodigo(String cid, String cursoId, String codigo) {
    jdbc.sql("update cursos set codigo = ? where colegio_id = ? and id = ?").params(codigo, cid, cursoId).update();
  }

  public boolean codigoExists(String codigo) {
    return jdbc.sql("select count(*) from cursos where codigo = ?").param(codigo).query(Long.class).single() > 0;
  }

  public Optional<CursoRef> findCursoByCodigo(String codigo) {
    return jdbc.sql("select colegio_id, id from cursos where codigo = ?")
        .param(codigo)
        .query((rs, i) -> new CursoRef(rs.getString("colegio_id"), rs.getString("id")))
        .optional();
  }

  // ---- estudiantes ----

  public Optional<Estudiante> findEstudiante(String cid, String cursoId, String uid) {
    return jdbc.sql("select * from estudiantes where colegio_id = ? and curso_id = ? and uid = ?")
        .params(cid, cursoId, uid)
        .query(this::mapEstudiante)
        .optional();
  }

  public List<Estudiante> roster(String cid, String cursoId) {
    return jdbc.sql("select * from estudiantes where colegio_id = ? and curso_id = ? order by joined_at")
        .params(cid, cursoId)
        .query(this::mapEstudiante)
        .list();
  }

  /** Idempotente: re-unirse conserva una activación previa. */
  public void insertEstudianteIfAbsent(String cid, String cursoId, String uid, String email, String nombre) {
    jdbc.sql(
            """
            insert into estudiantes (colegio_id, curso_id, uid, email, nombre, estado, atestado)
            values (?, ?, ?, ?, ?, 'pendiente_atestacion', false)
            on conflict do nothing
            """)
        .params(cid, cursoId, uid, email, nombre)
        .update();
  }

  public void setAtestacion(String cid, String cursoId, String uid, boolean atestado, String politica, String por) {
    jdbc.sql(
            """
            update estudiantes
               set atestado = ?, estado = ?, politica_version = ?, atestado_por = ?, atestado_at = now()
             where colegio_id = ? and curso_id = ? and uid = ?
            """)
        .params(atestado, atestado ? Estudiante.ACTIVO : Estudiante.PENDIENTE, politica, por, cid, cursoId, uid)
        .update();
  }

  public void marcarSuprimido(String cid, String cursoId, String uid) {
    jdbc.sql(
            """
            update estudiantes set estado = 'suprimido', atestado = false
             where colegio_id = ? and curso_id = ? and uid = ?
            """)
        .params(cid, cursoId, uid)
        .update();
  }

  private Curso mapCurso(ResultSet rs, int i) throws SQLException {
    Array profes = rs.getArray("profesor_uids");
    return new Curso(
        rs.getString("id"),
        rs.getString("nombre"),
        rs.getString("grado"),
        profes == null ? List.of() : List.of((String[]) profes.getArray()),
        rs.getString("codigo"),
        millis(rs.getTimestamp("created_at")),
        rs.getString("created_by"));
  }

  private Estudiante mapEstudiante(ResultSet rs, int i) throws SQLException {
    return new Estudiante(
        rs.getString("uid"),
        rs.getString("email"),
        rs.getString("nombre"),
        rs.getString("estado"),
        rs.getBoolean("atestado"),
        rs.getString("atestado_por"),
        millis(rs.getTimestamp("atestado_at")),
        rs.getString("politica_version"),
        millis(rs.getTimestamp("joined_at")));
  }

  private static Long millis(Timestamp t) {
    return t == null ? null : t.getTime();
  }
}
