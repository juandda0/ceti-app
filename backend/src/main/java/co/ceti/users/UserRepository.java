package co.ceti.users;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Optional;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@Repository
public class UserRepository {

  private final JdbcClient jdbc;
  private final JsonMapper json;

  public UserRepository(JdbcClient jdbc, JsonMapper json) {
    this.jdbc = jdbc;
    this.json = json;
  }

  public Optional<User> findById(String id) {
    return jdbc.sql("select * from users where id = ?").param(id).query(this::map).optional();
  }

  /**
   * Alta o re-login de una identidad externa. En re-login solo se refrescan email y foto: el
   * displayName es del usuario (lo edita en su perfil).
   */
  public User upsertIdentity(
      String provider, String sub, String email, String displayName, String photoUrl) {
    return jdbc.sql(
            """
            insert into users (id, provider, provider_sub, email, display_name, photo_url)
            values (?, ?, ?, ?, ?, ?)
            on conflict (provider, provider_sub) do update
              set email = excluded.email, photo_url = excluded.photo_url, updated_at = now()
            returning *
            """)
        .params(UUID.randomUUID().toString(), provider, sub, email, displayName, photoUrl)
        .query(this::map)
        .single();
  }

  public void updateProfile(String id, String displayName, JsonNode profile) {
    jdbc.sql(
            """
            update users set display_name = ?, profile = cast(? as jsonb), updated_at = now()
            where id = ?
            """)
        .params(displayName, json.writeValueAsString(profile), id)
        .update();
  }

  /** Único escritor de rol/tenant (R2). null en los tres = acceso revocado. */
  public void setAccess(String id, String role, String colegioId, String cursoId) {
    jdbc.sql(
            """
            update users set role = ?, colegio_id = ?, curso_id = ?, updated_at = now()
            where id = ?
            """)
        .params(role, colegioId, cursoId, id)
        .update();
  }

  private User map(ResultSet rs, int row) throws SQLException {
    String profile = rs.getString("profile");
    return new User(
        rs.getString("id"),
        rs.getString("provider"),
        rs.getString("email"),
        rs.getString("display_name"),
        rs.getString("photo_url"),
        profile == null ? null : json.readTree(profile),
        rs.getString("role"),
        rs.getString("colegio_id"),
        rs.getString("curso_id"));
  }
}
