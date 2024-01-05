export default function FooterNav() {
  return (
    <div className="lg:hidden fixed bottom-0 lg:left-auto w-full z-20 bg-[#ebebeb]">
      <nav aria-label="Bottom" data-orientation="horizontal" dir="ltr">
        <ul
          data-orientation="horizontal"
          className="group flex list-none items-start"
          dir="ltr"
        >
          <li className="rounded-xl">
            <a
              href="/"
              data-radix-collection-item=""
              rel="ugc"
              className="text-black"
            >
              <div className="flex flex-row py-4 px-6 gap-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  className="w-6 h-6"
                >
                  <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                  <polyline points="9 22 9 12 15 12 15 22"></polyline>
                </svg>
              </div>
            </a>
          </li>
          <li className="rounded-xl">
            <a
              href="/about-me"
              data-radix-collection-item=""
              rel="ugc"
              className="text-black"
            >
              <div className="flex flex-row py-4 px-6 gap-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  className="w-6 h-6"
                >
                  <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path>
                  <circle cx="12" cy="7" r="4"></circle>
                </svg>
              </div>
            </a>
          </li>
        </ul>
      </nav>
    </div>
  );
}
