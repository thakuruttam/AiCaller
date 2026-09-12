import React, { useEffect, useState } from 'react';
import './landing/landing.css';
import { Nav } from './landing/Nav';
import { Hero } from './landing/Hero';
import { DemoVideo } from './landing/DemoVideo';
import { Features } from './landing/Features';
import { HowItWorks } from './landing/HowItWorks';
import { ValueBand } from './landing/ValueBand';
import { Faq } from './landing/Faq';
import { FinalCta } from './landing/FinalCta';
import { Footer } from './landing/Footer';
import { TourModal } from './landing/TourModal';

export default function Landing() {
  const [tourOpen, setTourOpen] = useState(false);

  useEffect(() => {
    document.title = 'AI Caller Pro — AI Voice Calling & Outbound Campaign Platform';
  }, []);

  return (
    <div className="landing-page min-h-screen">
      <Nav onTakeTour={() => setTourOpen(true)} />
      <main>
        <Hero onTakeTour={() => setTourOpen(true)} />
        <Features />
        <HowItWorks />
        <ValueBand />
        <DemoVideo />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
      <TourModal open={tourOpen} onClose={() => setTourOpen(false)} />
    </div>
  );
}
