const headerH = 50
const footerH = 50
const sectionHeaderH = 50
const sectionFooterH = 50
const sidebarW = 360
const sidebarHeaderH = 50
const inputHeight = 40
const inlineSelectHeight = 65
const tabsHeight = 40
const modalSectionH = 65
const modalMargin = 30
const altInputH = 30
const tableHeaderOffset = 50
const rightDrawerW = 260
const subHeaderH = 40
const modalTabsH = 45
const editorHeaderH = 35

export const dims = {
  page: {
    top: 40,
  },
  header: {
    height: headerH,
    hpx: `${headerH}px`,
    avatar: {
      size: 35,
    },
    menu: {
      width: 165,
      height: 40,
    },
  },
  footer: {
    height: footerH,
    hpx: `${footerH}px`,
  },
  modal: {
    root: {
      margin: {
        size: modalMargin,
        px: `${modalMargin}px`,
      },
    },
    header: {
      height: modalSectionH,
      hpx: `${modalSectionH}px`,
    },
    footer: {
      height: modalSectionH,
      hpx: `${modalSectionH}px`,
    },
    tabs: {
      height: modalTabsH,
      hpx: `${modalTabsH}px`,
    },
  },
  dropdown: {
    header: {
      height: sectionHeaderH,
      px: `${sectionHeaderH}px`,
    },
  },
  section: {
    header: {
      height: subHeaderH,
      hpx: `${subHeaderH}px`,
    },
    footer: {
      height: sectionFooterH,
      hpx: `${sectionFooterH}px`,
    },
  },
  sidebar: {
    width: `${sidebarW}px`,
    minWidth: sidebarW,
    maxWidth: sidebarW,
    header: {
      height: sidebarHeaderH,
      hpx: `${sidebarHeaderH}px`,
    },
    search: {
      height: `75vh`,
    },
    recent: {
      height: `20vh`,
    },
  },
  rightDrawer: {
    width: rightDrawerW,
    wpx: `${rightDrawerW}px`,
  },
  form: {
    input: {
      height: inputHeight,
      hpx: `${inputHeight}px`,
    },
    inSelect: {
      height: inlineSelectHeight,
      hpx: `${inlineSelectHeight}px`,
    },
    alt: {
      height: altInputH,
      hpx: `${altInputH}px`,
    },
  },
  tabs: {
    height: tabsHeight,
    hpx: `${tabsHeight}px`,
  },
  border: {
    // Layered radius system
    xs: 4,
    xspx: `4px`,
    sm: 6,
    smpx: `6px`,
    md: 8,
    mdpx: `8px`,
    lg: 12,
    lgpx: `12px`,
    xl: 16,
    xlpx: `16px`,
    full: 9999,
    fullpx: `9999px`,

    // Backward-compatible aliases
    rpx: `6px`,
    radius: 6,
    input: 6,
    ipx: `6px`,
    theme: 8,
    tpx: `8px`,
  },
  table: {
    header: {
      height: 60,
      offset: tableHeaderOffset,
    },
    row: {
      height: 45,
      col: {
        width: 90,
      },
    },
    footer: {
      height: 60,
    },
  },
  editor: {
    section: {
      header: {
        height: editorHeaderH,
        hpx: `${editorHeaderH}px`,
      },
    },
  },
}
