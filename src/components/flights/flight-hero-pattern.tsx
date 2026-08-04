import Svg, { Path } from 'react-native-svg';

/** Decorative airflow lines inspired by the supplied aviation reference. */
export function FlightHeroPattern() {
  const paths = Array.from({ length: 11 }, (_, index) => {
    const offset = index * 10;
    return `M 12 ${20 + offset} C 92 ${8 + offset}, 114 ${58 + offset}, 178 ${68 + offset} S 264 ${42 + offset}, 300 ${88 + offset}`;
  });

  return (
    <Svg
      width="270"
      height="250"
      viewBox="0 0 300 250"
      style={{ position: 'absolute', right: -72, top: 116 }}
      pointerEvents="none"
      accessibilityElementsHidden
    >
      {paths.map((path, index) => (
        <Path
          key={index}
          d={path}
          fill="none"
          stroke="rgba(255,255,255,0.11)"
          strokeWidth={1.15}
          strokeLinecap="round"
        />
      ))}
    </Svg>
  );
}
