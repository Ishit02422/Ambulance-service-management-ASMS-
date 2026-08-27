import React, { useState, useEffect } from 'react';
import './LandingPage.css';
import { api } from '../services/api';

interface LandingPageProps {
  onGetStarted: () => void;
  onSignIn: () => void;
}

export function LandingPage({ onGetStarted, onSignIn }: LandingPageProps) {

  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [counters, setCounters] = useState({ ambulances: 0, hospitals: 0, trips: 0, years: 0 });

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Animated counters
  useEffect(() => {
    let active = true;
    let timer: NodeJS.Timeout;

    const animateCounters = (targets: { ambulances: number; hospitals: number; trips: number; years: number }) => {
      const duration = 1800;
      const steps = 60;
      const interval = duration / steps;
      let step = 0;
      timer = setInterval(() => {
        if (!active) return;
        step++;
        const progress = step / steps;
        setCounters({
          ambulances: Math.floor(targets.ambulances * progress),
          hospitals: Math.floor(targets.hospitals * progress),
          trips: Math.floor(targets.trips * progress),
          years: Math.floor(targets.years * progress),
        });
        if (step >= steps) clearInterval(timer);
      }, interval);
    };

    api.getPublicStats()
      .then((stats) => {
        if (active) animateCounters(stats);
      })
      .catch((err) => {
        console.error('Failed to fetch public stats, using fallback:', err);
        if (active) animateCounters({ ambulances: 120, hospitals: 48, trips: 3500, years: 10 });
      });

    return () => {
      active = false;
      if (timer) clearInterval(timer);
    };
  }, []);

  return (
    <div className="lp-root">
      {/* NAVBAR */}
      <nav className={`lp-nav ${scrolled ? 'lp-nav--scrolled' : ''}`}>
        <div className="lp-nav__brand">
          <span className="lp-nav__logo">🚑</span>
          <span className="lp-nav__title">ASMS</span>
        </div>

        <ul className={`lp-nav__links ${menuOpen ? 'lp-nav__links--open' : ''}`}>
          <li><a href="#home" onClick={() => setMenuOpen(false)}>Home</a></li>
          <li><a href="#features" onClick={() => setMenuOpen(false)}>Features</a></li>
          <li><a href="#how-it-works" onClick={() => setMenuOpen(false)}>How It Works</a></li>
          <li><a href="#contact" onClick={() => setMenuOpen(false)}>Contact</a></li>
        </ul>

        <div className="lp-nav__actions">
          <button id="lp-register-btn" className="lp-btn lp-btn--ghost" onClick={onGetStarted}>Register</button>
          <button id="lp-login-btn" className="lp-btn lp-btn--primary" onClick={onSignIn}>Login</button>
        </div>

        <button className="lp-nav__hamburger" onClick={() => setMenuOpen(o => !o)} aria-label="Toggle menu">
          <span /><span /><span />
        </button>
      </nav>

      {/* HERO */}
      <section id="home" className="lp-hero">
        <div className="lp-hero__bg-orb lp-hero__bg-orb--1" />
        <div className="lp-hero__bg-orb lp-hero__bg-orb--2" />

        <div className="lp-badge">
          <span className="lp-badge__dot" />
          ASMS — Serving Since 2015
        </div>

        <h1 className="lp-hero__heading">
          Save Lives with<br />
          <span className="lp-hero__accent">Smart Ambulance</span><br />
          Management.
        </h1>

        <p className="lp-hero__sub">
          An all-in-one digital platform for ambulance dispatch, real-time tracking,
          hospital coordination, and emergency management — all in one place.
        </p>

        <div className="lp-hero__cta">
          <button id="lp-hero-get-started" className="lp-btn lp-btn--primary lp-btn--lg" onClick={onGetStarted}>
            🚀 Get Started — Free
          </button>
          <button id="lp-hero-sign-in" className="lp-btn lp-btn--outline lp-btn--lg" onClick={onSignIn}>
            🔐 Sign In
          </button>
        </div>

        {/* Stats */}
        <div className="lp-stats">
          <div className="lp-stat">
            <span className="lp-stat__num">{counters.ambulances}+</span>
            <span className="lp-stat__label">Ambulances</span>
          </div>
          <div className="lp-stat">
            <span className="lp-stat__num">{counters.hospitals}+</span>
            <span className="lp-stat__label">Hospitals</span>
          </div>
          <div className="lp-stat">
            <span className="lp-stat__num">{counters.trips.toLocaleString()}+</span>
            <span className="lp-stat__label">Trips Completed</span>
          </div>
          <div className="lp-stat">
            <span className="lp-stat__num">{counters.years}+</span>
            <span className="lp-stat__label">Years Active</span>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" className="lp-section">
        <p className="lp-section__tag">What We Offer</p>
        <h2 className="lp-section__heading">Everything You Need<br />for Emergency Response</h2>

        <div className="lp-features">
          {[
            { icon: '📍', title: 'Real-Time Tracking', desc: 'GPS-based live location of every ambulance on an interactive map.' },
            { icon: '🏥', title: 'Hospital Network', desc: 'Instantly connect with nearby hospitals and check bed availability.' },
            { icon: '⚡', title: 'Fast Dispatch', desc: 'AI-powered auto-assign nearest available ambulance in seconds.' },
            { icon: '📋', title: 'Patient Records', desc: 'Digital patient history and medical info available on the go.' },
            { icon: '💳', title: 'Payment Gateway', desc: 'Seamless online payments with invoice generation and history.' },
            { icon: '📊', title: 'Admin Dashboard', desc: 'Full analytics, reports, and fleet management from one panel.' },
          ].map((f, i) => (
            <div key={i} className="lp-feature-card" style={{ '--delay': `${i * 0.08}s` } as React.CSSProperties}>
              <div className="lp-feature-card__icon">{f.icon}</div>
              <h3 className="lp-feature-card__title">{f.title}</h3>
              <p className="lp-feature-card__desc">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section id="how-it-works" className="lp-section lp-hiw">
        <p className="lp-section__tag">Simple Process</p>
        <h2 className="lp-section__heading">How It Works</h2>

        <div className="lp-steps">
          {[
            { num: '01', title: 'Register / Login', desc: 'Create your account as Patient, Driver, or Admin.' },
            { num: '02', title: 'Request Ambulance', desc: 'Patient submits a request with location and emergency type.' },
            { num: '03', title: 'Auto Dispatch', desc: 'Nearest available driver is assigned and notified instantly.' },
            { num: '04', title: 'Track & Arrive', desc: 'Live map tracking until ambulance reaches the patient.' },
          ].map((s, i) => (
            <div key={i} className="lp-step">
              <div className="lp-step__num">{s.num}</div>
              <div className="lp-step__content">
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
              {i < 3 && <div className="lp-step__arrow">&#8594;</div>}
            </div>
          ))}
        </div>
      </section>

      {/* ROLES */}
      <section className="lp-section">
        <p className="lp-section__tag">Roles</p>
        <h2 className="lp-section__heading">Built for Everyone</h2>
        <div className="lp-roles">
          {[
            { icon: '🧑‍⚕️', role: 'Patient', perks: ['Book ambulance instantly', 'Track in real-time', 'View ride history', 'Pay online'] },
            { icon: '🚑', role: 'Driver', perks: ['Receive dispatch alerts', 'Navigate with maps', 'Update trip status', 'View earnings'] },
            { icon: '🛡️', role: 'Admin', perks: ['Manage fleet & staff', 'View all live trips', 'Analytics & reports', 'Control hospital links'] },
          ].map((r, i) => (
            <div key={i} className={`lp-role-card ${i === 1 ? 'lp-role-card--highlight' : ''}`}>
              <div className="lp-role-card__icon">{r.icon}</div>
              <h3 className="lp-role-card__title">{r.role}</h3>
              <ul className="lp-role-card__list">
                {r.perks.map((p, j) => <li key={j}>&#10003; {p}</li>)}
              </ul>
              <button
                id={`lp-role-${r.role.toLowerCase()}-btn`}
                className={`lp-btn ${i === 1 ? 'lp-btn--primary' : 'lp-btn--ghost'} lp-btn--full`}
                onClick={onGetStarted}
              >
                Get Started as {r.role}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* CTA BANNER */}
      <section id="contact" className="lp-cta-banner">
        <div className="lp-hero__bg-orb lp-hero__bg-orb--3" />
        <h2>Ready to Save Lives?</h2>
        <p>Join thousands of emergency responders using ASMS every day.</p>
        <div className="lp-hero__cta">
          <button id="lp-final-cta" className="lp-btn lp-btn--primary lp-btn--lg" onClick={onGetStarted}>
            🚀 Start for Free
          </button>
          <button id="lp-final-login" className="lp-btn lp-btn--outline lp-btn--lg" onClick={onSignIn}>
            Already have an account? Login
          </button>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="lp-footer">
        <div className="lp-footer__brand">
          <span>🚑</span> ASMS
        </div>
        <p className="lp-footer__copy">
          &copy; {new Date().getFullYear()} Ambulance Service Management System. All rights reserved.
        </p>
        <div className="lp-footer__links">
          <a href="#home">Home</a>
          <a href="#features">Features</a>
          <a href="#how-it-works">How It Works</a>
        </div>
      </footer>
    </div>
  );
}
