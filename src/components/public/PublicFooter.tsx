import { Link } from "react-router-dom";

export function PublicFooter() {
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-6 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>© {year} Embudex</p>
        <div className="flex items-center gap-4">
          <Link to="/privacy" className="transition-colors hover:text-foreground">
            Privacy
          </Link>
          <a href="#" className="transition-colors hover:text-foreground">
            Terms
          </a>
        </div>
      </div>
    </footer>
  );
}
