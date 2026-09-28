/**
 * Een kubus in de affichekleuren — rood, blauw, geel, papier, šahovnica,
 * zwart. Een grafisch object zoals op de affiches van EXAT 51, maar dan in
 * drie dimensies: hij draait mee terwijl je scrolt, en een kwartslag bij
 * hover. Puur CSS; zonder scroll-animaties staat hij stil in driekwart.
 */
export function PosterCube({ size = 56, className = "" }: { size?: number; className?: string }) {
  const half = size / 2;
  const faces = [
    `rotateY(0deg) translateZ(${half}px)`,
    `rotateY(90deg) translateZ(${half}px)`,
    `rotateY(180deg) translateZ(${half}px)`,
    `rotateY(-90deg) translateZ(${half}px)`,
    `rotateX(90deg) translateZ(${half}px)`,
    `rotateX(-90deg) translateZ(${half}px)`,
  ];
  return (
    <span
      aria-hidden
      className={`cube-wrap block shrink-0 ${className}`}
      style={{ width: size, height: size, perspective: size * 9 }}
    >
      <span className="cube cube-scroll block h-full w-full">
        {faces.map((t) => (
          <i key={t} style={{ transform: t }} />
        ))}
      </span>
    </span>
  );
}
