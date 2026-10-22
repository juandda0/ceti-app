import { memo, useMemo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { SVGS } from '@features/avatar/assets/svgs.generated';
import { arteDe, personajePorId, type AvatarConfig } from '@features/avatar/domain/catalogo';
import { cajaDe, componerAvatar, type Encuadre } from '@features/avatar/domain/componer';

type Props = {
  config: AvatarConfig;
  /** `cuerpo`: de pie, `size` es el alto. `retrato`: cara en un círculo de `size`. */
  encuadre?: Encuadre;
  size: number;
  style?: StyleProp<ViewStyle>;
};

function AvatarView({ config, encuadre = 'cuerpo', size, style }: Props) {
  const { arte, prenda } = arteDe(config);
  const svgBase = SVGS[config.personaje][prenda] ?? SVGS[config.personaje].traje ?? '';
  const xml = useMemo(
    () =>
      componerAvatar(
        svgBase,
        arte,
        { tono: config.tono, pelo: config.pelo, accesorio: config.accesorio },
        encuadre
      ),
    [svgBase, arte, config.tono, config.pelo, config.accesorio, encuadre]
  );
  const [, , w, h] = cajaDe(arte, encuadre);
  const ancho = encuadre === 'retrato' ? size : (size * w) / h;

  return (
    <View
      style={[
        { width: ancho, height: size },
        encuadre === 'retrato' && { borderRadius: size / 2, overflow: 'hidden' },
        style,
      ]}
      accessible
      accessibilityRole="image"
      accessibilityLabel={personajePorId(config.personaje).nombre}
    >
      <SvgXml xml={xml} width={ancho} height={size} />
    </View>
  );
}

export default memo(AvatarView);
