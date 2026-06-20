export default function TopicBadge({ name, color }) {
  if (!name) return null;
  return (
    <span
      className="inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full"
      style={{ backgroundColor: color + '22', color }}
    >
      {name}
    </span>
  );
}
