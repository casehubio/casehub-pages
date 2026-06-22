/*
 
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *        http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import * as React from "react";
import { useState, useEffect, useCallback, useRef } from "react";
import type { EChartOption, EChartsType } from "echarts";
import { init } from "echarts";

/**
 * A chart option record that allows dynamic property access via fillProperties.
 * Uses an index signature to support the string-path property-setting code path.
 */
interface ChartOptionRecord extends EChartOption {
  [key: string]: unknown;
}

const OPTION_PARAM = "option";
const DATASET_PARAM = "dataSet";
const INIT_OPTIONS: EChartOption = {
  tooltip: {},
  xAxis: { type: "category" },
  yAxis: {},
  series: [],
};

export interface Props {
  option?: EChartOption;
  params?: Map<string, string>;
  theme?: string;
  refresh?: boolean;
}

type EChartsTypeWithTheme = EChartsType & { theme?: string };

export function ECharts(props: Props) {
  const container = useRef<HTMLDivElement>(null);
  const [chart, setChart] = useState<EChartsTypeWithTheme | undefined>();

  useEffect(() => {
    if (container.current && !chart) {
      const _chart = init(container.current, props.theme) as EChartsTypeWithTheme;
      _chart.setOption(INIT_OPTIONS);
      if (props.theme) {
        _chart.theme = props.theme;
      }
      setChart(_chart);
    }
  }, [chart, props]);

  window.onresize = useCallback(() => {
    if (chart) chart.resize();
  }, [chart]);

  useEffect(() => {
    if (!chart) {
      return;
    }
    if (chart.theme != props.theme) {
      chart.dispose();
      setChart(undefined);
    } else {
      console.log(props);
      let option: ChartOptionRecord = (props.option ?? {}) as ChartOptionRecord;
      if (props.params) {
        props.params.delete(DATASET_PARAM);
        option = fillProperties(props.params, option);
      }
      // replicate first series configuration if a single serie configuration object is provided
      const dataset = option.dataset as { source?: unknown[][] } | undefined;
      const seriesVal = option.series;
      const nColumns = (Array.isArray(dataset?.source?.[0]) ? dataset.source[0].length : 0);
      if (seriesVal && !Array.isArray(seriesVal) && nColumns > 1) {
        option = { ...option, series: Array(nColumns - 1).fill(seriesVal) as EChartOption.Series[] };
      }
      chart.setOption(option);
    }
  }, [props, chart]);

  return (
    <>
      <div style={{ width: "100%", height: "100%" }} ref={container}></div>
    </>
  );
}

export const fillProperties = (props: Map<string, string>, option?: ChartOptionRecord): ChartOptionRecord => {
  let result: ChartOptionRecord = option ?? {};
  const optionStr = props.get(OPTION_PARAM);
  if (optionStr) {
    try {
      const parsedOption = JSON.parse(optionStr) as ChartOptionRecord;
      result = { ...result, ...parsedOption };
    } catch {
      console.log("Not able to parse option property");
    }
    props.delete(OPTION_PARAM);
  }
  props.forEach((value, key) => setPropertyOnObject(key, value, result));
  return result;
};

const setPropertyOnObject = (prop: string, value: string, obj: Record<string, unknown>): Record<string, unknown> => {
  if (!prop || !value) {
    return obj;
  }
  const props = prop.split(".");
  let parent: Record<string, unknown> = obj;
  for (let i = 0; i < props.length; i++) {
    const name = props[i];
    if (!name) continue;
    if (i === props.length - 1) {
      parent[name] = value;
    } else {
      if (!parent[name] || typeof parent[name] !== "object") {
        parent[name] = {};
      }
      parent = parent[name] as Record<string, unknown>;
    }
  }
  return obj;
};
