"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Code2,
  FileText,
  FolderUp,
  Layers,
  Lock,
  Clock,
  Zap,
  Users,
  Shield,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";

const features = [
  {
    icon: Code2,
    title: "Live Code Editor",
    description:
      "Monaco-powered collaboration with cursors, syntax highlighting, and multi-language support.",
  },
  {
    icon: FileText,
    title: "Rich Text & Markdown",
    description:
      "Write notes with markdown, lists, tables, and live preview — synced instantly.",
  },
  {
    icon: FolderUp,
    title: "File Transfers",
    description:
      "Drag & drop images, PDFs, ZIPs, videos. Preview and download with progress tracking.",
  },
  {
    icon: Users,
    title: "Live Presence",
    description:
      "See who's online, typing indicators, and colored cursors — no accounts needed.",
  },
  {
    icon: Clock,
    title: "Auto Expiration",
    description:
      "Rooms self-destruct on schedule. Files, data, and sockets cleaned up completely.",
  },
  {
    icon: Shield,
    title: "Privacy First",
    description:
      "Numeric room codes, temporary tokens, rate limits, and no permanent identity.",
  },
];

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0 },
};

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 hero-mesh" />
      <div className="pointer-events-none absolute inset-0 grid-pattern opacity-60" />

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-4 py-5">
        <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 text-white shadow-lg shadow-violet-500/30">
            <Sparkles className="h-4 w-4" />
          </div>
          <span>TempShare</span>
        </Link>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/join">Join Room</Link>
          </Button>
          <ThemeToggle />
        </div>
      </header>

      <main className="relative z-10">
        {/* Hero */}
        <section className="mx-auto max-w-6xl px-4 pb-20 pt-16 text-center sm:pt-24">
          <motion.div
            initial="initial"
            animate="animate"
            transition={{ staggerChildren: 0.1 }}
          >
            <motion.div variants={fadeUp} transition={{ duration: 0.5 }}>
              <Badge
                variant="outline"
                className="mb-6 gap-1.5 border-violet-500/30 bg-violet-500/10 px-3 py-1 text-violet-300"
              >
                <Zap className="h-3 w-3" />
                No signup · Instant rooms · Auto-destruct
              </Badge>
            </motion.div>

            <motion.h1
              variants={fadeUp}
              transition={{ duration: 0.5 }}
              className="mx-auto max-w-4xl text-4xl font-bold tracking-tight sm:text-6xl lg:text-7xl"
            >
              Share{" "}
              <span className="bg-gradient-to-r from-violet-400 via-indigo-400 to-cyan-400 bg-clip-text text-transparent">
                Code. Text. Files.
              </span>
              <br />
              Instantly. Securely. Temporarily.
            </motion.h1>

            <motion.p
              variants={fadeUp}
              transition={{ duration: 0.5 }}
              className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground sm:text-xl"
            >
              A real-time collaboration room with a 6-digit code. Paste code, write notes,
              drop files — everything expires when you say so.
            </motion.p>

            <motion.div
              variants={fadeUp}
              transition={{ duration: 0.5 }}
              className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row"
            >
              <Button variant="gradient" size="xl" asChild>
                <Link href="/create">
                  Create Room
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              <Button variant="outline" size="xl" asChild>
                <Link href="/join">Join Room</Link>
              </Button>
            </motion.div>

            {/* Mock room code preview */}
            <motion.div
              variants={fadeUp}
              transition={{ duration: 0.5 }}
              className="mx-auto mt-16 max-w-md rounded-2xl border border-border/60 bg-card/60 p-6 shadow-2xl shadow-violet-500/5 backdrop-blur-xl"
            >
              <p className="text-xs uppercase tracking-widest text-muted-foreground">
                Example room code
              </p>
              <p className="mt-2 font-mono text-4xl font-bold tracking-[0.35em] text-foreground">
                483920
              </p>
              <div className="mt-4 flex items-center justify-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" /> 49:58 left
                </span>
                <span className="flex items-center gap-1">
                  <Users className="h-3 w-3" /> 3 online
                </span>
                <span className="flex items-center gap-1">
                  <Lock className="h-3 w-3" /> Ephemeral
                </span>
              </div>
            </motion.div>
          </motion.div>
        </section>

        {/* Share types */}
        <section className="mx-auto max-w-6xl px-4 py-12">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Code2, label: "Code", desc: "Monaco collab" },
              { icon: FileText, label: "Text", desc: "Markdown notes" },
              { icon: FolderUp, label: "Files", desc: "Drag & drop" },
              { icon: Layers, label: "Mixed", desc: "All in one" },
            ].map((item, i) => (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.05 }}
                className="rounded-xl border border-border/60 bg-card/50 p-5 backdrop-blur-sm transition-colors hover:border-violet-500/30 hover:bg-card"
              >
                <item.icon className="mb-3 h-6 w-6 text-violet-400" />
                <h3 className="font-semibold">{item.label}</h3>
                <p className="text-sm text-muted-foreground">{item.desc}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Features */}
        <section className="mx-auto max-w-6xl px-4 py-20">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Built for speed & simplicity
            </h2>
            <p className="mt-3 text-muted-foreground">
              Pastebin meets Live Share meets WeTransfer — without the friction.
            </p>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.06 }}
                className="group rounded-2xl border border-border/60 bg-card/40 p-6 backdrop-blur-sm transition-all hover:border-violet-500/25 hover:shadow-lg hover:shadow-violet-500/5"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400 transition-colors group-hover:bg-violet-500/20">
                  <f.icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {f.description}
                </p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="mx-auto max-w-6xl px-4 pb-24">
          <div className="relative overflow-hidden rounded-3xl border border-violet-500/20 bg-gradient-to-br from-violet-600/20 via-indigo-600/10 to-transparent p-10 text-center sm:p-16">
            <h2 className="text-2xl font-bold sm:text-3xl">
              Ready to share something temporary?
            </h2>
            <p className="mx-auto mt-3 max-w-md text-muted-foreground">
              Create a room in under a second. Share the code. Walk away when it expires.
            </p>
            <Button variant="gradient" size="lg" className="mt-8" asChild>
              <Link href="/create">
                Create a free room
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </section>
      </main>

      <footer className="relative z-10 border-t border-border/40 py-8 text-center text-sm text-muted-foreground">
        <p>TempShare · Ephemeral by design · No accounts</p>
      </footer>
    </div>
  );
}
