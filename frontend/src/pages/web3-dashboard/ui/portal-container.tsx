import * as React from "react";

// Radix portals (dropdown menus, selects, tooltips, sheets) mount to
// document.body by default, which is OUTSIDE the .web3-dashboard scope that
// --background/--popover/--primary/etc. are scoped under (see dashboard.css).
// That left every portaled panel with no theme variables to read — e.g.
// bg-popover resolved to nothing, so dropdown content had a fully
// transparent background and page content behind it showed straight
// through. Mounting portals into a node that itself lives inside
// .web3-dashboard fixes the inheritance chain.
const PortalContainerContext = React.createContext(null);

export function PortalContainerProvider({ children }) {
  const [container, setContainer] = React.useState(null);
  return (
    <PortalContainerContext.Provider value={container}>
      {children}
      <div ref={setContainer} />
    </PortalContainerContext.Provider>
  );
}

export function usePortalContainer() {
  return React.useContext(PortalContainerContext);
}
