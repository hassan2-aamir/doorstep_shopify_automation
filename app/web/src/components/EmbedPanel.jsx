import { Banner, Button, Skeleton } from './ui.jsx';

// The Fastn connections widget: skeleton while the token is minted, a recoverable error, then the iframe.
export function EmbedPanel({ embed, title = 'Connect your accounts (Fastn)' }) {
  return (
    <>
      {embed.loading && <Skeleton className="h-[560px]" />}
      {embed.error && (
        <Banner
          variant="danger"
          title="Couldn't load your connections"
          action={<Button variant="secondary" onClick={embed.reload}>Retry</Button>}
        >
          {embed.error.message}. The rest of Doorstep keeps working.
        </Banner>
      )}
      {embed.url && !embed.loading && (
        <iframe
          title={title}
          src={embed.url}
          allow="clipboard-write"
          className="h-[560px] w-full rounded-md border-thick border-block-border bg-block"
        />
      )}
    </>
  );
}
