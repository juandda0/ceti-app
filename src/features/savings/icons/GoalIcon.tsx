import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { GOAL_ICON_IDS, isGoalIconId, type GoalIconId } from '@features/savings/domain/savings';

export { GOAL_ICON_IDS, isGoalIconId };
export type { GoalIconId };

interface GoalIconProps {
  id: GoalIconId;
  color: string;
  size?: number;
}

export function GoalIcon({ id, color, size = 28 }: GoalIconProps) {
  const common = { fill: 'none', stroke: color, strokeWidth: 1.8, strokeLinecap: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden>
      {id === 'bike' && (
        <>
          <Circle cx="6" cy="17" r="3" {...common} />
          <Circle cx="18" cy="17" r="3" {...common} />
          <Path d="M6 17l4-7 3 7m-5-4h8l-2-5h-2" {...common} />
        </>
      )}
      {id === 'book' && (
        <Path
          d="M4 5c3-1 5 0 8 2v13c-3-2-5-3-8-2V5zm16 0c-3-1-5 0-8 2m8-2v13c-3-1-5 0-8 2"
          {...common}
        />
      )}
      {id === 'laptop' && (
        <>
          <Rect x="5" y="4" width="14" height="11" rx="1" {...common} />
          <Path d="M3 19h18l-2-4H5l-2 4z" {...common} />
        </>
      )}
      {id === 'plane' && <Path d="M3 13l18-9-6 16-3-6-5-1 4-3" {...common} />}
      {id === 'shield' && (
        <Path d="M12 3l7 3v5c0 5-3 8-7 10-4-2-7-5-7-10V6l7-3zm-3 9l2 2 4-5" {...common} />
      )}
      {id === 'target' && (
        <>
          <Circle cx="12" cy="12" r="8" {...common} />
          <Circle cx="12" cy="12" r="4" {...common} />
          <Circle cx="12" cy="12" r="1" fill={color} />
        </>
      )}
    </Svg>
  );
}
