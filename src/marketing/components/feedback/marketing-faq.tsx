"use client";

import { ChevronDown } from "lucide-react";
import { Accordion } from "radix-ui";

import type { FaqItemContent } from "@/marketing/types";

export interface MarketingFaqProps {
  readonly items: readonly FaqItemContent[];
}

export function MarketingFaq({ items }: MarketingFaqProps) {
  return (
    <Accordion.Root className="bceo-faq" type="single" collapsible>
      {items.map((item) => (
        <Accordion.Item className="bceo-faq__item" key={item.id} value={item.id}>
          <Accordion.Header className="bceo-faq__heading">
            <Accordion.Trigger className="bceo-faq__trigger">
              <span className="bceo-faq__question">{item.question}</span>
              <ChevronDown
                className="bceo-faq__icon"
                aria-hidden="true"
                focusable="false"
                size={20}
                strokeWidth={1.75}
              />
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Content className="bceo-faq__content">
            <p className="bceo-faq__answer">{item.answer}</p>
          </Accordion.Content>
        </Accordion.Item>
      ))}
    </Accordion.Root>
  );
}
