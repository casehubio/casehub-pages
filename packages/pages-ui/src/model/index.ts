// Core types
export type {
  Component,
  AccessControl,
  GridPlacement,
  GridItem,
  PermissionContext,
} from "./types.js";
export { ALLOW_ALL } from "./types.js";

// Component props
export type {
  GridProps,
  ColumnsProps,
  RowsProps,
  StackProps,
  TabsProps,
  PillsProps,
  SidebarProps,
  TreeProps,
  MenuProps,
  AccordionProps,
  CarouselProps,
  AppGridProps,
  PanelProps,
  HtmlProps,
  MarkdownProps,
  TitleProps,
  LazyPageProps,
  FilterSettings,
  DrillDown,
  RefreshSettings,
} from "./component-props.js";

// Page types (runtime types defined here, component-level types re-exported from pages-component)
export type {
  PageProps,
  PageSettings,
  DataComponentDefaults,
  LookupDefaults,
  DataSetDefaults,
  DataScope,
  DataScopeRef,
  SaveConfig,
  ViewState,
  DrillDownStep,
  LayoutOverride,
  DeepLink,
  Site,
} from "./page-types.js";

// Displayer types (re-exported from pages-component)
export type {
  DataComponentCommon,
  ChartSettings,
  BarChartProps,
  LineChartProps,
  AreaChartProps,
  PieChartProps,
  ScatterChartProps,
  BubbleChartProps,
  TimeseriesProps,
  TableProps,
  MetricProps,
  MeterProps,
  SelectorProps,
  MapProps,
  IframePluginProps,
} from "@casehub/pages-component";

// Form input types (re-exported from pages-component)
export type {
  FormInputCommon,
  TextInputProps,
  NumberInputProps,
  FixedOptions,
  DataSetOptions,
  DropdownProps,
  CheckboxProps,
  DatePickerProps,
  TextareaProps,
} from "@casehub/pages-component";
export { isFixedOptions } from "@casehub/pages-component";

// Type guards
export type { ComponentTypeRegistry } from "./type-guards.js";
export {
  getProps,
  isGrid,
  isColumns,
  isRows,
  isStack,
  isTabs,
  isPills,
  isSidebar,
  isTree,
  isMenu,
  isAccordion,
  isCarousel,
  isAppGrid,
  isPanel,
  isHtml,
  isMarkdown,
  isTitle,
  isPage,
  isLazyPage,
  isBarChart,
  isLineChart,
  isAreaChart,
  isPieChart,
  isScatterChart,
  isBubbleChart,
  isTimeseries,
  isTable,
  isMetric,
  isMeter,
  isSelector,
  isMap,
  isIframePlugin,
  isTextInput,
  isNumberInput,
  isDropdown,
  isCheckbox,
  isDatePicker,
  isTextarea,
  isFormInput,
} from "./type-guards.js";
