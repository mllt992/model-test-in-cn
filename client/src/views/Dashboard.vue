<template>
  <div class="dashboard">
    <h2 class="page-title">数据统计</h2>

    <div class="chart-row">
      <div class="chart-card chart-card--pie">
        <h3 class="chart-title">测试题类别占比</h3>
        <div ref="pieRef" class="chart-container"></div>
      </div>
      <div class="chart-card chart-card--cloud">
        <h3 class="chart-title">题目词云</h3>
        <div ref="questionCloudRef" class="chart-container"></div>
      </div>
    </div>
    <div class="chart-row">
      <div class="chart-card chart-card--full">
        <h3 class="chart-title">回答词云</h3>
        <div ref="answerCloudRef" class="chart-container chart-container--tall"></div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, shallowRef } from 'vue';
import * as echarts from 'echarts';
import 'echarts-wordcloud';
import { statsAPI } from '@/api';

const pieRef = ref(null);
const questionCloudRef = ref(null);
const answerCloudRef = ref(null);

const pieChart = shallowRef(null);
const questionCloudChart = shallowRef(null);
const answerCloudChart = shallowRef(null);

const pieColors = [
  '#0052D9', '#0594FA', '#00A870', '#E37318',
  '#C9353F', '#8B5CF6', '#ED7BCC', '#029CD4',
  '#B88230', '#2BA471',
];

const renderPie = (data) => {
  if (!pieRef.value) return;
  if (!pieChart.value) pieChart.value = echarts.init(pieRef.value);
  pieChart.value.setOption({
    tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
    color: pieColors,
    series: [{
      type: 'pie',
      radius: ['40%', '70%'],
      center: ['50%', '55%'],
      avoidLabelOverlap: true,
      itemStyle: { borderRadius: 6, borderColor: '#fff', borderWidth: 2 },
      label: { show: true, formatter: '{b}\n{d}%', fontSize: 12 },
      data: data.map((d) => ({ name: d.category, value: d.count })),
    }],
  }, true);
};

const renderWordCloud = (chart, container, data) => {
  if (!container) return;
  if (!chart.value) chart.value = echarts.init(container);
  chart.value.setOption({
    series: [{
      type: 'wordCloud',
      shape: 'circle',
      left: 'center',
      top: 'center',
      width: '90%',
      height: '90%',
      sizeRange: [14, 48],
      rotationRange: [-45, 45],
      rotationStep: 15,
      gridSize: 6,
      drawOutOfBound: false,
      textStyle: {
        fontFamily: 'PingFang SC, Microsoft YaHei, sans-serif',
        color() {
          return pieColors[Math.floor(Math.random() * pieColors.length)];
        },
      },
      emphasis: { textStyle: { shadowBlur: 6, shadowColor: 'rgba(0,0,0,0.2)' } },
      data: data.map((d) => ({ name: d.name, value: d.value })),
    }],
  }, true);
};

const loadData = async () => {
  try {
    const [catRes, qRes, aRes] = await Promise.all([
      statsAPI.categoryDistribution(),
      statsAPI.questionWordcloud(),
      statsAPI.answerWordcloud(),
    ]);
    renderPie(catRes.data || []);
    renderWordCloud(questionCloudChart, questionCloudRef.value, qRes.data || []);
    renderWordCloud(answerCloudChart, answerCloudRef.value, aRes.data || []);
  } catch {}
};

const handleResize = () => {
  pieChart.value?.resize();
  questionCloudChart.value?.resize();
  answerCloudChart.value?.resize();
};

onMounted(() => {
  loadData();
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  pieChart.value?.dispose();
  questionCloudChart.value?.dispose();
  answerCloudChart.value?.dispose();
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
.chart-card--pie {
  width: 40%;
}
.chart-card--cloud {
  flex: 1;
}
.chart-card--full {
  width: 100%;
}
.chart-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 12px;
}
.chart-container {
  width: 100%;
  height: 300px;
}
.chart-container--tall {
  height: 320px;
}
</style>
