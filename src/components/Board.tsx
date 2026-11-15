import React from 'react';
import { Pressable } from 'react-native';
import Svg, { G, Polygon, Polyline } from 'react-native-svg';
import { Level, arrowShape } from '../game/logic';

interface Props {
  level: Level; cs: number; fg: string; acc: string; bad: string;
  hintId: number | null; now: number; onTap: (x: number, y: number) => void;
}

export default function Board({ level, cs, fg, acc, bad, hintId, now, onTap }: Props) {
  const { cols, rows, arrows } = level;
  return (
    <Pressable onPress={(e) => onTap(e.nativeEvent.locationX, e.nativeEvent.locationY)} style={{ width: cols * cs, height: rows * cs }}>
      <Svg width={cols * cs} height={rows * cs} pointerEvents="none">
        {arrows.map((a) => {
          if (a.out && !a.sliding) return null;
          const sh = arrowShape(a, cs, cols, rows);
          if (!sh) return null;
          const age = now - a.bad;
          const flashing = a.bad > 0 && age < 450;
          const hinted = a.id === hintId;
          const color = flashing ? bad : hinted ? acc : fg;
          const dx = flashing ? Math.sin(age * 0.05) * cs * 0.12 * (1 - age / 450) : 0;
          const [hx, hy] = sh.head;
          const [ux, uy] = a.d, hw = cs * 0.27;
          const tri = [
            [hx + ux * cs * 0.55, hy + uy * cs * 0.55],
            [hx + ux * cs * 0.05 - uy * hw, hy + uy * cs * 0.05 + ux * hw],
            [hx + ux * cs * 0.05 + uy * hw, hy + uy * cs * 0.05 - ux * hw],
          ].map((p) => p.join(',')).join(' ');
          return (
            <G key={a.id} transform={`translate(${dx},0)`} opacity={hinted ? 0.6 + 0.4 * Math.sin(now * 0.01) : 1}>
              <Polyline points={sh.line.map((p) => p.join(',')).join(' ')} fill="none" stroke={color}
                strokeWidth={Math.max(2, cs * 0.14)} strokeLinecap="round" strokeLinejoin="round" />
              <Polygon points={tri} fill={color} />
            </G>
          );
        })}
      </Svg>
    </Pressable>
  );
}
