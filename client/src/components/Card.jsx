export default function Card({ text, className = '', children }) {
  return (
    <div
      className={`bg-card rounded-2xl shadow-lg p-6 text-zinc-800 ${className}`}
    >
      {text && (
        <p className="text-lg leading-relaxed font-medium text-center">{text}</p>
      )}
      {children}
    </div>
  );
}
