const generateLinkPreview = (
  title: string | null = 'Link Preview',
  description: string | null = 'Link Description',
  image: string | null = '#'
) => {
  return `
      <html>
      <head>
        <meta property="og:title" content="${title}" />
        <meta property="og:description" content="${description}" />
        <meta property="og:image" content="${image}" />
      </head>
    </html>
      `;
};

export default generateLinkPreview;
