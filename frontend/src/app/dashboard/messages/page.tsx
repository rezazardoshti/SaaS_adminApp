export default function MessagesPage() {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="max-w-3xl">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
          Messages
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          Here you can manage internal company communication, announcements, and
          message history.
        </p>
      </div>

      <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6">
        <p className="text-sm text-slate-500">
          This area is ready. In the next step, we can connect your real
          message data or build the message UI structure.
        </p>
      </div>
    </section>
  );
}