import React from 'react';
import MarketingLayout from './Layout';
import { Hero, Stats, SeeItInAction, ProductTour, Capabilities, HowItWorks, Trust, Faq, FinalCta } from './Sections';
import { useSeo } from '../../seo/useSeo';

export default function Marketing() {
  useSeo('/');
  return (
    <MarketingLayout>
      <Hero />
      <Stats />
      <SeeItInAction />
      <ProductTour />
      <Capabilities />
      <HowItWorks />
      <Trust />
      <Faq />
      <FinalCta />
    </MarketingLayout>
  );
}
