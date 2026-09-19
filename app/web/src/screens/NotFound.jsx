import { Link } from 'react-router-dom';
import { useScreen } from '../lib/useScreen.js';
import { Block, Button, ScreenHeading } from '../components/ui.jsx';

export function NotFound() {
  const headingRef = useScreen('Page not found');
  return (
    <div className="space-y-block-tight">
      <ScreenHeading headingRef={headingRef} title="Page not found" />
      <Block className="flex flex-col items-start gap-4">
        <p>That page doesn't exist.</p>
        <Button as={Link} to="/today">Go to Today</Button>
      </Block>
    </div>
  );
}
