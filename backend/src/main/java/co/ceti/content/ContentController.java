package co.ceti.content;

import co.ceti.shared.ApiException;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import tools.jackson.databind.JsonNode;

/** Bancos globales: cualquier usuario autenticado los lee; nadie los escribe por API (R8). */
@RestController
@RequestMapping("/api/content")
public class ContentController {

  private final ContentCatalog catalog;

  public ContentController(ContentCatalog catalog) {
    this.catalog = catalog;
  }

  @GetMapping("/bancos/{id}")
  public JsonNode banco(@PathVariable String id) {
    return catalog.banco(id).orElseThrow(() -> ApiException.notFound("Banco no encontrado."));
  }

  @GetMapping("/elige-camino/{id}")
  public JsonNode eligeCamino(@PathVariable String id) {
    return catalog.eligeCamino(id).orElseThrow(() -> ApiException.notFound("Banco no encontrado."));
  }

  @GetMapping("/microteoria/{id}")
  public JsonNode microteoria(@PathVariable String id) {
    return catalog.microteoria(id).orElseThrow(() -> ApiException.notFound("Banco no encontrado."));
  }
}
