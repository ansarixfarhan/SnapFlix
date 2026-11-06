import Script from "next/script";

export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="w-full h-full">
      {/* Monetag Pure OnClick Popunder (Zone: 12199846 - No notifications/push, only hidden new-tab popunder) */}
      <Script
        id="monetag-popunder"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `(function(s){s.dataset.zone='12199846',s.src='https://al5sm.com/tag.min.js'})([document.documentElement, document.body].filter(Boolean).pop().appendChild(document.createElement('script')));`,
        }}
      />
      {children}
    </div>
  );
}
