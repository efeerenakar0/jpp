import {
  BellRing,
  Building2,
  Check,
  CircleDot,
  MessageSquareText,
  Radar,
  Search,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";

import type { RealEstateContent } from "@/marketing/types";

export function WhatsAppOperationsDemo({
  content,
}: {
  readonly content: RealEstateContent["whatsappOperations"];
}) {
  return (
    <article
      className="bceo-re-demo bceo-re-demo--operations"
      aria-label={content.title}
      data-re-demo
    >
      <div className="bceo-re-demo__topbar">
        <div className="bceo-re-demo__controls" aria-hidden="true">
          <span className="bceo-re-demo__control" />
          <span className="bceo-re-demo__control" />
          <span className="bceo-re-demo__control" />
        </div>
        <div className="bceo-re-demo__identity">
          <span className="bceo-re-demo__identity-icon" aria-hidden="true">
            <MessageSquareText size={18} strokeWidth={1.7} />
          </span>
          <h3 className="bceo-re-demo__title">{content.approvedDescriptor}</h3>
        </div>
        <span className="bceo-re-demo__status" aria-hidden="true">
          <CircleDot size={14} strokeWidth={1.8} />
        </span>
      </div>

      <div className="bceo-re-demo__body">
        <ol className="bceo-re-demo__flow" aria-label={content.title} data-re-sequence>
          {content.flow.map((step, index) => (
            <li
              className="bceo-re-demo__flow-item"
              key={step.id}
              data-re-sequence-step
            >
              <span className="bceo-re-demo__step-index" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="bceo-re-demo__step-marker" aria-hidden="true">
                <Check size={14} strokeWidth={2} />
              </span>
              <span className="bceo-re-demo__step-copy">
                <strong className="bceo-re-demo__step-title">{step.label}</strong>
                <span className="bceo-re-demo__step-description">{step.description}</span>
              </span>
            </li>
          ))}
        </ol>

        <aside className="bceo-re-demo__side-panel" data-re-reveal="operations-context">
          <div className="bceo-re-demo__disclosure">
            <ShieldCheck
              className="bceo-re-demo__disclosure-icon"
              aria-hidden="true"
              size={19}
              strokeWidth={1.7}
            />
            <p className="bceo-re-demo__disclosure-copy">{content.aiDisclosure}</p>
          </div>

          <ul className="bceo-re-demo__capabilities">
            {content.capabilities.slice(0, 4).map((capability) => (
              <li className="bceo-re-demo__capability" key={capability}>
                <span className="bceo-re-demo__capability-dot" aria-hidden="true" />
                {capability}
              </li>
            ))}
          </ul>
        </aside>
      </div>
    </article>
  );
}

export function PortfolioHunterDemo({
  content,
}: {
  readonly content: RealEstateContent["portfolioHunter"];
}) {
  return (
    <article
      className="bceo-re-demo bceo-re-demo--portfolio"
      aria-label={content.title}
      data-re-demo
    >
      <div className="bceo-re-demo__topbar">
        <div className="bceo-re-demo__controls" aria-hidden="true">
          <span className="bceo-re-demo__control" />
          <span className="bceo-re-demo__control" />
          <span className="bceo-re-demo__control" />
        </div>
        <div className="bceo-re-demo__identity">
          <span className="bceo-re-demo__identity-icon" aria-hidden="true">
            <Radar size={18} strokeWidth={1.7} />
          </span>
          <h3 className="bceo-re-demo__title">{content.title}</h3>
        </div>
        <span className="bceo-re-demo__status" aria-hidden="true">
          <Search size={14} strokeWidth={1.8} />
        </span>
      </div>

      <div className="bceo-re-demo__body bceo-re-demo__body--portfolio">
        <div className="bceo-re-demo__signal-stage" aria-hidden="true">
          <span className="bceo-re-demo__radar-ring bceo-re-demo__radar-ring--outer" />
          <span className="bceo-re-demo__radar-ring bceo-re-demo__radar-ring--middle" />
          <span className="bceo-re-demo__radar-ring bceo-re-demo__radar-ring--inner" />
          <span className="bceo-re-demo__radar-axis bceo-re-demo__radar-axis--horizontal" />
          <span className="bceo-re-demo__radar-axis bceo-re-demo__radar-axis--vertical" />
          <span className="bceo-re-demo__signal-node bceo-re-demo__signal-node--one">
            <Building2 size={16} strokeWidth={1.7} />
          </span>
          <span className="bceo-re-demo__signal-node bceo-re-demo__signal-node--two">
            <Building2 size={14} strokeWidth={1.7} />
          </span>
          <span className="bceo-re-demo__signal-node bceo-re-demo__signal-node--three">
            <Building2 size={15} strokeWidth={1.7} />
          </span>
          <span className="bceo-re-demo__signal-focus">
            <Radar size={25} strokeWidth={1.5} />
          </span>
        </div>

        <div className="bceo-re-demo__portfolio-context">
          <ol
            className="bceo-re-demo__flow bceo-re-demo__flow--compact"
            aria-label={content.title}
            data-re-sequence
          >
            {content.flow.map((step, index) => (
              <li
                className="bceo-re-demo__flow-item"
                key={step.id}
                data-re-sequence-step
              >
                <span className="bceo-re-demo__step-index" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="bceo-re-demo__step-copy">
                  <strong className="bceo-re-demo__step-title">{step.label}</strong>
                  <span className="bceo-re-demo__step-description">{step.description}</span>
                </span>
              </li>
            ))}
          </ol>

          <p className="bceo-re-demo__scope-note">
            <ShieldCheck aria-hidden="true" size={17} strokeWidth={1.7} />
            <span>{content.scopeNote}</span>
          </p>
        </div>
      </div>

      <ul className="bceo-re-demo__capability-strip" data-re-sequence>
        {content.capabilities.map((capability, index) => (
          <li
            className="bceo-re-demo__capability-chip"
            key={capability}
            data-re-sequence-step
          >
            {index === content.capabilities.length - 1 ? (
              <BellRing aria-hidden="true" size={15} strokeWidth={1.7} />
            ) : (
              <Check aria-hidden="true" size={15} strokeWidth={1.9} />
            )}
            <span>{capability}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

export function GeneralManagerDemo({
  content,
}: {
  readonly content: RealEstateContent["generalManager"];
}) {
  return (
    <article
      className="bceo-re-demo bceo-re-demo--manager"
      aria-label={content.title}
      data-re-demo
    >
      <div className="bceo-re-demo__topbar">
        <div className="bceo-re-demo__controls" aria-hidden="true">
          <span className="bceo-re-demo__control" />
          <span className="bceo-re-demo__control" />
          <span className="bceo-re-demo__control" />
        </div>
        <div className="bceo-re-demo__identity">
          <span className="bceo-re-demo__identity-icon" aria-hidden="true">
            <Sparkles size={18} strokeWidth={1.7} />
          </span>
          <h3 className="bceo-re-demo__title">{content.title}</h3>
        </div>
        <span className="bceo-re-demo__status" aria-hidden="true">
          <UsersRound size={15} strokeWidth={1.7} />
        </span>
      </div>

      <div className="bceo-re-demo__manager-body">
        <blockquote className="bceo-re-demo__owner-question" data-re-reveal="manager-question">
          <Sparkles
            className="bceo-re-demo__question-icon"
            aria-hidden="true"
            size={20}
            strokeWidth={1.6}
          />
          <p className="bceo-re-demo__question-copy">{content.exampleOwnerQuestion}</p>
        </blockquote>

        <div
          className="bceo-re-demo__manager-grid"
          aria-label={content.description}
          data-re-sequence
        >
          {content.capabilities.map((capability, index) => (
            <section
              className="bceo-re-demo__manager-card"
              key={capability}
              data-re-sequence-step
            >
              <span className="bceo-re-demo__manager-card-icon" aria-hidden="true">
                {index === 0 ? (
                  <UsersRound size={17} strokeWidth={1.7} />
                ) : index === 1 ? (
                  <MessageSquareText size={17} strokeWidth={1.7} />
                ) : index === 2 ? (
                  <BellRing size={17} strokeWidth={1.7} />
                ) : (
                  <Radar size={17} strokeWidth={1.7} />
                )}
              </span>
              <h4 className="bceo-re-demo__manager-card-title">{capability}</h4>
              <span className="bceo-re-demo__manager-card-line" aria-hidden="true" />
              <span className="bceo-re-demo__manager-card-line" aria-hidden="true" />
            </section>
          ))}
        </div>

        <p className="bceo-re-demo__manager-summary">{content.description}</p>
      </div>
    </article>
  );
}
