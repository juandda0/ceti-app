/**
 * Elegir un PDF y leerlo en base64 (Fase 4: material del profe para la IA).
 * En web, el selector del navegador; en el celular, el de documentos.
 * null si el profe cancela.
 */
import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';

export async function elegirPdfBase64(): Promise<{ nombre: string; base64: string } | null> {
  const r = await DocumentPicker.getDocumentAsync({
    type: 'application/pdf',
    copyToCacheDirectory: true,
    multiple: false,
  });
  if (r.canceled || !r.assets?.[0]) return null;
  const asset = r.assets[0];
  if (Platform.OS === 'web' && asset.file) {
    const datos = await new Promise<string>((resolve, reject) => {
      const lector = new FileReader();
      lector.onload = () => resolve(String(lector.result ?? ''));
      lector.onerror = () => reject(lector.error);
      lector.readAsDataURL(asset.file as Blob);
    });
    return { nombre: asset.name, base64: datos.replace(/^data:[^,]*,/, '') };
  }
  return { nombre: asset.name, base64: await new File(asset.uri).base64() };
}
