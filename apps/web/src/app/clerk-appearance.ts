/** The marketing palette, for every Clerk component. */
export const clerkAppearance = {
  variables: {
    colorPrimary: '#C9974E',
    colorPrimaryForeground: '#1A140A',
    colorBackground: '#090807',
    colorForeground: '#EDE8DF',
    colorMutedForeground: '#9E978B',
    colorInput: '#090807',
    colorInputForeground: '#EDE8DF',
    colorNeutral: '#EDE8DF',
    colorBorder: '#22201D',
    borderRadius: '10px',
  },
};

/** The embedded sign-in and sign-up forms drop Clerk's own card, because the page supplies the frame. */
export const authFormAppearance = {
  elements: {
    cardBox: { width: '100%', boxShadow: 'none', border: 0, background: 'transparent' },
    card: { padding: 0, boxShadow: 'none', border: 0, background: 'transparent' },
    header: { display: 'none' },
    footer: { background: 'transparent' },
    footerAction: { display: 'none' },
    rootBox: { width: '100%' },
  },
};
