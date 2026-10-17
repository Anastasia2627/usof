import React from 'react';
import { Icon, go } from '../ui.jsx';

// Intentionally not a feed: the first visit invites users to join.
// Public, read-only posts remain accessible through Explore for the
// university demonstration without exposing write actions to guests.
export default function WelcomePage() {
  return <main className="welcomePage">
    <section className="welcomeHero">
      <div className="welcomeSymbol" aria-hidden="true"><Icon name="forum" size={32} /></div>
      <p className="welcomeEyebrow">A place for real conversations</p>
      <h1>Talk about what matters.</h1>
      <p className="welcomeLead">Ask questions, share little discoveries and meet people who have something to say.</p>
      <div className="welcomeButtons">
        <button className="primary welcomePrimary" onClick={() => go('/register')}>Join Circle <Icon name="arrow" size={20}/></button>
        <button className="welcomeSecondary" onClick={() => go('/login')}>I already have an account</button>
      </div>
      <p className="welcomeBrowse">Just looking around? <button onClick={() => go('/explore')}>Explore public conversations <Icon name="arrow" size={17}/></button></p>
    </section>
    <section className="welcomeHighlights" aria-label="What can I do on Circle?">
      <div><Icon name="chat" size={24}/><h2>Start a conversation</h2><p>Share a thought or ask a question.</p></div>
      <div><Icon name="favorite" size={24}/><h2>Find your people</h2><p>React, reply and discover new perspectives.</p></div>
      <div><Icon name="group" size={24}/><h2>Follow your curiosity</h2><p>Browse topics that interest you.</p></div>
    </section>
  </main>;
}
