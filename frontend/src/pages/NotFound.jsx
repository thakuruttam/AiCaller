import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Page, EmptyState, Button } from '../components/ui';

// Any signed-in URL that matches no route lands here. Without it the inner
// <Routes> matched nothing and <main> rendered empty, so a mistyped or stale
// link looked identical to the app failing to load.
export default function NotFound() {
  const navigate = useNavigate();

  return (
    <Page>
      <EmptyState
        icon="explore_off"
        title="Page not found"
        body="That link doesn't point anywhere in the app. It may have moved, or the address may be mistyped."
        action={
          <div className="flex items-center gap-3">
            <Button variant="primary" icon="home" onClick={() => navigate('/')}>Go to dashboard</Button>
            <Button variant="secondary" icon="arrow_back" onClick={() => navigate(-1)}>Go back</Button>
          </div>
        }
      />
    </Page>
  );
}
