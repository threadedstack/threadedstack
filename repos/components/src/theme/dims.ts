const headerH = 60
const footerH = 60
const sectionHeaderH = 50
const sectionFooterH = 60
const sidebarW = 360
const sidebarHeaderH = 60
const sidebarMinW = sidebarW
const sidebarMaxW = sidebarW
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
    }
  },
  sidebar: {
    width: `${sidebarW}px`,
    minWidth: sidebarMinW,
    maxWidth: sidebarMaxW,
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
      hpx: `${altInputH}px`
    }
  },
  tabs: {
    height: tabsHeight,
    hpx: `${tabsHeight}px`,
  },
  border: {
    rpx: `2px`,
    radius: 2,
    input: 5,
    ipx: `5px`,
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
