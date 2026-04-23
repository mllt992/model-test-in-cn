<template>
  <div class="dashboard">
    <h2 class="page-title">数据统计</h2>

    <div class="chart-row">
      <div class="chart-card chart-card--half">
        <h3 class="chart-title">类别拒答情况</h3>
        <div ref="barRef" class="chart-container"></div>
      </div>
    </div>
    <div class="chart-row">
      <div class="chart-card chart-card--half">
        <h3 class="chart-title">测试题类型占比</h3>
        <div ref="typePieRef" class="chart-container"></div>
      </div>
      <div class="chart-card chart-card--half">
        <h3 class="chart-title">测试题类别占比</h3>
        <div ref="pieRef" class="chart-container"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, shallowRef } from 'vue';
import * as echarts from 'echarts';
import { statsAPI } from '@/api';

const typePieRef = ref(null);
const pieRef = ref(null);
const barRef = ref(null);

const typePieChart = shallowRef(null);
const pieChart = shallowRef(null);
const barChart = shallowRef(null);

const pieColors = [
  '#0052D9', '#0594FA', '#00A870', '#E37318',
  '#C9353F', '#8B5CF6', '#ED7BCC', '#029CD4',
  '#B88230', '#2BA471',
];

const renderPie = (chart, container, data) => {
  if (!container) return;
  if (!chart.value) chart.value = echarts.init(container);
  chart.value.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    color: pieColors,
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['50%', '55%'],
      avoidLabelOverlap: true,
      itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
      label: { show: true, formatter: '{b}\n{d}%', fontSize: 12 },
      data: data.map((d) => ({ name: d.category || d.type, value: d.count })),
    }],
  }, true);
};

const renderStackedBar = (data) => {
  if (!barRef.value) return;
  if (!barChart.value) barChart.value = echarts.init(barRef.value);
  const categories = data.map((d) => d.category);
  const refused = data.map((d) => d.refused);
  const answered = data.map((d) => d.answered);
  barChart.value.setOption({
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    legend: { data: ['拒答', '非拒答'], bottom: 0 },
    grid: { left: '3%', right: '4%', bottom: '15%', top: '10%', containLabel: true },
    xAxis: { type: 'category', data: categories, axisLabel: { rotate: 30, fontSize: 11 } },
    yAxis: { type: 'value', name: '数量' },
    series: [
      { name: '拒答', type: 'bar', stack: 'total', data: refused, itemStyle: { color: '#C9353F' } },
      { name: '非拒答', type: 'bar', stack: 'total', data: answered, itemStyle: { color: '#00A870' } },
    ],
  }, true);
};

const loadData = async () => {
  try {
    const res = await statsAPI.getAll();
    const { typeDistribution, categoryDistribution, categoryRejection } = res.data;
    renderStackedBar(categoryRejection || []);
    renderPie(typePieChart, typePieRef.value, typeDistribution || []);
    renderPie(pieChart, pieRef.value, categoryDistribution || []);
  } catch {}
};

const handleResize = () => {
  typePieChart.value?.resize();
  pieChart.value?.resize();
  barChart.value?.resize();
};

onMounted(() => {
  loadData();
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  typePieChart.value?.dispose();
  pieChart.value?.dispose();
  barChart.value?.dispose();
});
</script>

<style scoped>
.dashboard {
  background: #fff;
  padding: 20px 24px;
  border-radius: 8px;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
}
.page-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 16px;
  flex-shrink: 0;
}
.chart-row {
  display: flex;
  gap: 16px;
  margin-bottom: 16px;
}
.chart-card {
  background: #fafafa;
  border-radius: 8px;
  padding: 16px;
  border: 1px solid #e7e7e7;
}
.chart-card--half {
  flex: 1;
}
.chart-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 12px;
}
.chart-container {
  width: 100%;
  height: 320px;
}
</style>
