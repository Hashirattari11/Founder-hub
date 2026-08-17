import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus } from 'lucide-react'
import { SectionHeading } from './SectionHeading'

const faqs = [
  {
    question: 'How does FounderHub match me with the right people?',
    answer:
      'Our matching engine analyzes your startup stage, industry, skills, and goals against every founder, developer, and investor on the platform. You get a match score plus a ranked list — so you can focus on the best-fit conversations first.',
  },
  {
    question: 'Is FounderHub free to start?',
    answer:
      'Yes. The Free plan includes your startup profile, the community feed, and basic matching. Upgrade to Pro when you are ready to raise or need AI tools, and contact us for Enterprise plans.',
  },
  {
    question: 'Can I use FounderHub to raise money from investors?',
    answer:
      'Absolutely. Pro founders get the Deal Room — a secure space to share your pitch deck, financials, and term sheet with vetted investors, complete with engagement analytics to tell you who is actually interested.',
  },
  {
    question: 'What makes the AI Startup Generator different?',
    answer:
      'Instead of generic templates, it builds a tailored business plan, product roadmap, and pitch outline from your specific idea. It learns your market and refines as you add details.',
  },
  {
    question: 'How is my startup data kept secure?',
    answer:
      'Your data is protected with encryption in transit and at rest. Deal Room access is permission-controlled, so you decide exactly who sees sensitive documents — and when you revoke access, it is gone.',
  },
  {
    question: 'Can investors and accelerators join too?',
    answer:
      'Yes. Investors get a curated deal flow matched to their thesis, portfolio management tools, and direct messaging with founders. We also offer white-label and API plans for studios and accelerators.',
  },
]

function FaqItem({ question, answer, index }: { question: string; answer: string; index: number }) {
  const [open, setOpen] = useState(index === 0)

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-40px' }}
      transition={{ duration: 0.4, delay: index * 0.06 }}
      className={`overflow-hidden rounded-2xl border transition-colors duration-300 ${
        open
          ? 'border-primary/40 bg-white shadow-lg shadow-primary/5 dark:border-primary/40 dark:bg-dark-100'
          : 'border-gray-200 bg-white dark:border-dark-300 dark:bg-dark-100'
      }`}
    >
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
      >
        <span className="text-base font-semibold">{question}</span>
        <span
          className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full transition-all duration-300 ${
            open ? 'bg-gradient-brand text-white rotate-180' : 'bg-gray-100 text-gray-500 dark:bg-dark-200 dark:text-gray-400'
          }`}
        >
          <Plus className="h-4 w-4" />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            <p className="px-6 pb-5 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
              {answer}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

export function FAQ() {
  return (
    <section id="faq" className="relative py-24 lg:py-32">
      <div className="hero-grid pointer-events-none absolute inset-0 opacity-40" />
      <div className="container-x relative">
        <SectionHeading
          eyebrow="FAQ"
          title="Questions? Answered."
          description="Everything you need to know before you build with FounderHub."
        />

        <div className="mx-auto mt-16 max-w-3xl space-y-4">
          {faqs.map((faq, index) => (
            <FaqItem key={faq.question} question={faq.question} answer={faq.answer} index={index} />
          ))}
        </div>
      </div>
    </section>
  )
}
