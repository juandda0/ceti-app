/** Íconos de Órbita: la moneda Ceti y el escudo de racha (planos, sin contorno, como el resto). */
import Svg, { Circle, Path } from 'react-native-svg';

export function MonedaCeti({ size = 18 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Circle cx={12} cy={12} r={10} fill="#E5A438" />
      <Circle cx={12} cy={12} r={7.4} fill="#F7C95F" />
      <Path fill="#E5A438" d="M14.6 9.3a3.6 3.6 0 1 0 0 5.4l-1.3-1.2a1.9 1.9 0 1 1 0-3z" />
    </Svg>
  );
}

export function EscudoRacha({ size = 18, activo = true }: { size?: number; activo?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path fill={activo ? '#5FCFC8' : '#3A3A5E'} d="M12 2l8 3v6c0 5.2-3.4 9.1-8 11-4.6-1.9-8-5.8-8-11V5z" />
      <Path fill={activo ? '#FFFFFF55' : '#FFFFFF22'} d="M12 4.2v15.6c3.4-1.6 6-4.8 6-8.8V6.4z" />
    </Svg>
  );
}
