export function Header() {
  return (
    <header className="py-12">
      <nav className="grid grid-cols-2">
        <div className="justify-self-start text-lg">IVOKUN</div>
        <div className="justify-self-end">
          <ul className="flex space-x-4">
            <li>
              <a href="/" className="text-lg text-blue-600 hover:text-blue-800">
                Home
              </a>
            </li>
            <li>
              <a
                href="/posts"
                className="text-lg text-blue-600 hover:text-blue-800"
              >
                Posts
              </a>
            </li>
            <li>
              <a
                href="/galleries"
                className="text-lg text-blue-600 hover:text-blue-800"
              >
                Galleries
              </a>
            </li>
          </ul>
        </div>
      </nav>
    </header>
  );
}
