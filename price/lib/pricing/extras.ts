import "server-only";

import extras from "@/data/plan-extras.json";

type PlanAddOn = {
  name: string;
  price?: string;
  description?: string;
};

type PlanFaq = {
  question: string;
  answer: string;
};

export type PlanExtras = {
  tagline?: string;
  summary?: string;
  highlights?: string[];
  addons?: PlanAddOn[];
  faqs?: PlanFaq[];
};

export type ServiceExtras = {
  serviceHeadline?: string;
  serviceHighlights?: string[];
  plans?: Record<string, PlanExtras>;
};

const extrasData = extras as Record<string, ServiceExtras>;

const normalizeKey = (value: string) => value.trim().toLowerCase();

export const getServiceExtras = (serviceKey: string): ServiceExtras | null => {
  const normalized = normalizeKey(serviceKey);
  return extrasData[normalized] ?? null;
};

export const getPlanExtras = (
  serviceKey: string,
  planKey: string,
): PlanExtras | null => {
  const service = getServiceExtras(serviceKey);
  if (!service?.plans) {
    return null;
  }

  const normalizedPlan = normalizeKey(planKey);
  return service.plans?.[normalizedPlan] ?? null;
};

