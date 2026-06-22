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
import type { ComponentController, DataSet } from "@casehub/pages-iframe-api";
import { MessageProperty } from "@casehub/pages-iframe-api";
import { useState, useEffect } from "react";
import type { Props as EChartsProps } from "@casehub/pages-echarts-base";
import { ECharts } from "@casehub/pages-echarts-base";

interface Props {
  controller: ComponentController;
}

export function EChartsComponent(props: Props) {
  const [echartsProps, setEchartsProps] = useState<EChartsProps>();
  useEffect(() => {
    props.controller.setOnDataSet((_dataset: DataSet, params?: Map<string, unknown>) => {
      const option: Record<string, unknown> = {
        dataset: {
          source: [_dataset.columns.map((c) => c.settings.columnName), ..._dataset.data],
        },
      };
      const echartsResult: EChartsProps = { option };
      if (params) {
        echartsResult.params = params;
        const theme = params.get(MessageProperty.MODE);
        if (theme) echartsResult.theme = theme as string;
      }
      setEchartsProps(echartsResult);
    });
  }, [props.controller]);

  return (
    <>
      <ECharts {...echartsProps} />
    </>
  );
}
