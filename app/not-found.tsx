import Link from "next/link";

export default function NotFound() {
  return (
    <main id="main" className="wrap py-24">
      <p className="label">404</p>
      <h1 className="mt-3 text-3xl font-semibold">That page is not here.</h1>
      <Link href="/" className="btn btn-primary mt-6">Back to the start</Link>
    </main>
  );
}
