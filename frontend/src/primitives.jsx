import { useEffect, useRef, useState } from "react";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
  useTransform,
  useMotionTemplate,
  useScroll,
  animate,
} from "motion/react";


// AnimatedNumber: counts up from 0 to the value
export function AnimatedNumber({ value, decimals = 1, prefix = "", suffix = "", duration = 1.3, className }) {
  const count = useMotionValue(0);
  const text = useTransform(count, (v) =>
    prefix +
    Number(v).toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) +
    suffix
  );

  useEffect(() => {
    const controls = animate(count, value, { duration, ease: "easeOut" });
    return () => controls.stop();
  }, [value]);

  return <motion.span className={className}>{text}</motion.span>;
}

// ScrambleText: letters flicker like a decoder, then settle (replays on hover)
const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&*+/";

export function ScrambleText({ text, speed = 28, className }) {
  const [out, setOut] = useState(text);
  const timer = useRef(null);

  function run() {
    clearInterval(timer.current);
    let tick = 0;
    timer.current = setInterval(() => {
      tick += 1;
      const settled = Math.floor(tick / 2);
      setOut(
        text
          .split("")
          .map((ch, i) => {
            if (/[\s>-]/.test(ch) || i < settled) return ch;
            return GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          })
          .join("")
      );
      if (settled >= text.length) {
        clearInterval(timer.current);
        setOut(text);
      }
    }, speed);
  }

  useEffect(() => {
    run();
    return () => clearInterval(timer.current);
  }, [text]);

  return (
    <span className={className} onMouseEnter={run}>
      {out}
    </span>
  );
}

// SplitText: every letter springs in one after another
export function SplitText({ text, className, delay = 0, stagger = 0.03 }) {
  let n = 0;
  return (
    <span className={className} aria-label={text}>
      {text.split(" ").map((word, w) => (
        <span key={w} aria-hidden="true" style={{ display: "inline-block", whiteSpace: "pre" }}>
          {word.split("").map((ch, i) => {
            const d = delay + n * stagger;
            n += 1;
            return (
              <motion.span
                key={i}
                style={{ display: "inline-block" }}
                initial={{ opacity: 0, y: 50, rotate: 8 }}
                animate={{ opacity: 1, y: 0, rotate: 0 }}
                transition={{ delay: d, type: "spring", stiffness: 260, damping: 16 }}
              >
                {ch}
              </motion.span>
            );
          })}
          {" "}
        </span>
      ))}
    </span>
  );
}

// Magnetic: the child gets pulled toward the mouse
export function Magnetic({ children, strength = 0.35 }) {
  const ref = useRef(null);
  const x = useSpring(0, { stiffness: 220, damping: 14 });
  const y = useSpring(0, { stiffness: 220, damping: 14 });

  function move(e) {
    const r = ref.current.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * strength);
    y.set((e.clientY - (r.top + r.height / 2)) * strength);
  }
  function leave() {
    x.set(0);
    y.set(0);
  }

  return (
    <motion.div ref={ref} style={{ x, y, display: "inline-block" }} onMouseMove={move} onMouseLeave={leave}>
      {children}
    </motion.div>
  );
}

// Tilt: the card leans toward the mouse in 3D
export function Tilt({ children, max = 9, className, style, ...rest }) {
  const ref = useRef(null);
  const rx = useSpring(0, { stiffness: 220, damping: 18 });
  const ry = useSpring(0, { stiffness: 220, damping: 18 });

  function move(e) {
    const r = ref.current.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    ry.set(px * max * 2);
    rx.set(-py * max * 2);
  }
  function leave() {
    rx.set(0);
    ry.set(0);
  }

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ ...style, rotateX: rx, rotateY: ry, transformPerspective: 900 }}
      whileHover={{ scale: 1.03 }}
      onMouseMove={move}
      onMouseLeave={leave}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

// Flashlight: a yellow beam follows the mouse over the section
export function Flashlight({ children, className }) {
  const ref = useRef(null);
  const x = useMotionValue(-500);
  const y = useMotionValue(-500);
  const beam = useMotionTemplate`radial-gradient(300px circle at ${x}px ${y}px, rgba(255, 214, 10, 0.35), transparent 70%)`;

  function move(e) {
    const r = ref.current.getBoundingClientRect();
    x.set(e.clientX - r.left);
    y.set(e.clientY - r.top);
  }

  return (
    <div ref={ref} className={className} onMouseMove={move} style={{ position: "relative" }}>
      <motion.div className="beam" style={{ background: beam }} />
      {children}
    </div>
  );
}

// MagnifierCursor: a red magnifying glass that follows the mouse and grows over clickable things
export function MagnifierCursor() {
  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const sx = useSpring(x, { stiffness: 600, damping: 40, mass: 0.4 });
  const sy = useSpring(y, { stiffness: 600, damping: 40, mass: 0.4 });
  const [big, setBig] = useState(false);

  useEffect(() => {
    function move(e) {
      x.set(e.clientX);
      y.set(e.clientY);
      const t = e.target;
      setBig(!!(t && t.closest && t.closest("button, [data-hot], label, input")));
    }
    window.addEventListener("mousemove", move);
    return () => window.removeEventListener("mousemove", move);
  }, []);

  return <motion.div className="cursor" style={{ x: sx, y: sy }} animate={{ scale: big ? 1.9 : 1 }} />;
}

// TextLoop: cycles through lines of text
export function TextLoop({ items, interval = 1500, className }) {
  const [i, setI] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % items.length), interval);
    return () => clearInterval(t);
  }, [items.length, interval]);

  return (
    <span className={className} style={{ display: "inline-block" }}>
      <AnimatePresence mode="wait">
        <motion.span
          key={i}
          style={{ display: "inline-block" }}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -14 }}
          transition={{ duration: 0.25 }}
        >
          {items[i]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}

// Marquee: endless scrolling strip (the crime-scene tape)
export function Marquee({ children, speed = 30, reverse = false }) {
  return (
    <div className="marquee">
      <motion.div
        className="marquee-track"
        animate={{ x: reverse ? ["-50%", "0%"] : ["0%", "-50%"] }}
        transition={{ duration: speed, ease: "linear", repeat: Infinity }}
      >
        {children}
        {children}
      </motion.div>
    </div>
  );
}

// Reveal: fades and slides up when scrolled into view
export function Reveal({ children, delay = 0, y = 40, className }) {
  return (
    <motion.div
      className={"reveal " + (className || "")}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

// Stamp: slams down onto the page
export function Stamp({ children }) {
  return (
    <motion.div
      className="stamp display"
      initial={{ scale: 3.2, opacity: 0, rotate: -30 }}
      animate={{ scale: 1, opacity: 1, rotate: -11 }}
      transition={{ type: "spring", stiffness: 520, damping: 17, delay: 1 }}
    >
      {children}
    </motion.div>
  );
}

// SlidingTabs: the highlight slides from one tab to the next
export function SlidingTabs({ options, value, onChange, id }) {
  return (
    <div className="tabs">
      {options.map((o) => (
        <button key={o.value} className={"tab" + (value === o.value ? " on" : "")} onClick={() => onChange(o.value)} data-hot>
          {value === o.value && (
            <motion.span layoutId={"pill-" + id} className="tab-pill" transition={{ type: "spring", stiffness: 500, damping: 34 }} />
          )}
          <span className="tab-label">{o.label}</span>
        </button>
      ))}
    </div>
  );
}

// ScrollProgress: a thin bar at the top that fills as you scroll down the page
export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 140, damping: 24, mass: 0.3 });
  return <motion.div className="progress" style={{ scaleX }} />;
}

// Accordion: click a question to open or close its answer
export function Accordion({ items }) {
  const [open, setOpen] = useState(0);

  return (
    <div className="faq">
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div key={item.q} className={"faq-item" + (isOpen ? " open" : "")}>
            <button
              type="button"
              className="faq-q display"
              aria-expanded={isOpen}
              data-hot
              onClick={() => setOpen(isOpen ? -1 : i)}
            >
              <span>{item.q}</span>
              <motion.span className="faq-plus" animate={{ rotate: isOpen ? 45 : 0 }} transition={{ type: "spring", stiffness: 400, damping: 20 }}>
                +
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {isOpen && (
                <motion.div
                  className="faq-a-wrap"
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                >
                  <p className="faq-a type">{item.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

// Modal: a confirmation box that pops over the page (Escape or a click outside closes it)
export function Modal({ open, title, children, onClose }) {
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="modal-back" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label={title}
            initial={{ scale: 0.8, y: 40, rotate: -3 }}
            animate={{ scale: 1, y: 0, rotate: 0 }}
            exit={{ scale: 0.9, y: 20, opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="display modal-title">{title}</div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
