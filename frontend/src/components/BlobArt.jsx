// CSS stand-in for the 3D sphere renders in the reference design — layered
// radial-gradient spheres with a specular highlight and a pale tube threading
// between them. Swap for real renders by dropping an <img> in the same slot.
export default function BlobArt({ className = '' }) {
  return (
    <div className={`blob-art ${className}`.trim()}>
      <span className="b2" />
      <span className="b3" />
      <span className="tube" />
      <span className="b1" />
    </div>
  );
}
