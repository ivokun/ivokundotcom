export function Header() {
  return (
    <header className="mt-12">
      <nav className="grid grid-cols-10 justify-items-center">
        <div className="col-span-7 justify-self-start text-lg">IVOKUN</div>

        <a href="/" className="text-lg text-blue-600 hover:text-blue-800">
          Home
        </a>
        <a href="/me" className="text-lg text-blue-600 hover:text-blue-800">
          Me
        </a>
        <a href="/posts" className="text-lg text-blue-600 hover:text-blue-800">
          Posts
        </a>
      </nav>
    </header>
  );
}
