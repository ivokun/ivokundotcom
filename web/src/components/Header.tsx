export function Header() {
  return (
    <header>
      <nav className="grid grid-cols-4">
        <a href="/" className="text-black no-underline">
          Home
        </a>
        <a href="/about" className="text-black no-underline">
          About
        </a>
      </nav>
    </header>
  );
}
