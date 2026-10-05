package co.ceti.users;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.json.JsonMapper;

@RestController
@RequestMapping("/api/me")
public class MeController {

  public record Profile(
      @NotBlank @Size(min = 2, max = 40) String nickname,
      @Size(max = 80) String fullName,
      @Size(max = 40) String avatarId,
      @Size(max = 16) String avatarEmoji) {}

  public record ProfileUpdate(@NotBlank @Size(max = 80) String displayName, @NotNull @Valid Profile profile) {}

  private final UserRepository users;
  private final JsonMapper json;

  public MeController(UserRepository users, JsonMapper json) {
    this.users = users;
    this.json = json;
  }

  @GetMapping
  public UserView me(User u) {
    return UserView.of(u);
  }

  @PutMapping("/profile")
  public UserView updateProfile(User u, @Valid @RequestBody ProfileUpdate body) {
    users.updateProfile(u.id(), body.displayName().trim(), json.valueToTree(body.profile()));
    return UserView.of(users.findById(u.id()).orElseThrow());
  }
}
