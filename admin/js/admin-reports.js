// admin-reports.js - Analytics & Reports Functionality
class AdminReports {
    constructor() {
        this.charts = {};
        this.reportData = {};
        this.chartTypes = {};
        this.dateRange = {
            start: moment().subtract(30, 'days'),
            end: moment()
        };
    }

    /**
     * Initialize reports page
     */
    async init() {
        try {
            // Initialize core
            await adminCore.init();
            
            // Initialize date range picker
            this.initDateRangePicker();
            
            // Initialize UI components
            this.initUIComponents();
            
            // Load initial report data
            await this.loadReportData();
            
            // Set up event listeners
            this.setupEventListeners();
            
        } catch (error) {
            console.error('Reports initialization error:', error);
        }
    }

    /**
     * Initialize date range picker
     */
    initDateRangePicker() {
        $('#dateRangePicker').daterangepicker({
            startDate: this.dateRange.start,
            endDate: this.dateRange.end,
            ranges: {
                'Today': [moment(), moment()],
                'Yesterday': [moment().subtract(1, 'days'), moment().subtract(1, 'days')],
                'Last 7 Days': [moment().subtract(6, 'days'), moment()],
                'Last 30 Days': [moment().subtract(29, 'days'), moment()],
                'This Month': [moment().startOf('month'), moment().endOf('month')],
                'Last Month': [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')]
            },
            locale: {
                format: 'MMM D, YYYY',
                applyLabel: 'Apply',
                cancelLabel: 'Cancel',
                customRangeLabel: 'Custom Range'
            }
        }, (start, end) => {
            this.dateRange = { start, end };
            this.updateReportPeriod();
        });
        
        this.updateReportPeriod();
    }

    /**
     * Initialize UI components
     */
    initUIComponents() {
        // Initialize selects
        $('select').formSelect();
        
        // Initialize modals
        this.reportModal = M.Modal.init($('#reportGenerationModal')[0]);
        
        // Set default chart types
        this.chartTypes = {
            userGrowth: 'line',
            matchSuccess: 'doughnut',
            engagementTime: 'bar',
            lgaPerformance: 'bar',
            demographics: 'bar'
        };
    }

    /**
     * Update report period display
     */
    updateReportPeriod() {
        const format = 'MMM D, YYYY';
        const period = `${this.dateRange.start.format(format)} - ${this.dateRange.end.format(format)}`;
        $('#reportPeriod').text(period);
    }

    /**
     * Load report data
     */
    async loadReportData() {
        try {
            adminCore.showLoading();
            
            const params = {
                start_date: this.dateRange.start.format('YYYY-MM-DD'),
                end_date: this.dateRange.end.format('YYYY-MM-DD'),
                granularity: $('#granularity').val()
            };
            
            // Load all data in parallel
            const [metrics, growthData, matchData, engagementData, lgaData] = await Promise.all([
                this.fetchKeyMetrics(params),
                this.fetchUserGrowthData(params),
                this.fetchMatchData(params),
                this.fetchEngagementData(params),
                this.fetchLGAData(params)
            ]);
            
            // Update report data
            this.reportData = {
                metrics,
                growthData,
                matchData,
                engagementData,
                lgaData
            };
            
            // Update UI
            this.updateKeyMetrics(metrics);
            this.renderCharts();
            this.updateLGATable(lgaData);
            this.generateInsights();
            this.updateReportSummary();
            
            adminCore.hideLoading();
            
        } catch (error) {
            console.error('Load report data error:', error);
            adminCore.showToast('Failed to load report data', 'error');
            adminCore.hideLoading();
        }
    }

    /**
     * Fetch key metrics
     */
    async fetchKeyMetrics(params) {
        try {
            const queryString = new URLSearchParams(params).toString();
            const response = await fetch(`${adminCore.apiBaseUrl}/admin/reports/metrics?${queryString}`, {
                headers: adminCore.getAuthHeaders()
            });
            
            if (!response.ok) throw new Error('Failed to fetch metrics');
            
            return await response.json();
            
        } catch (error) {
            console.error('Fetch metrics error:', error);
            return this.getMockMetrics();
        }
    }

    /**
     * Fetch user growth data
     */
    async fetchUserGrowthData(params) {
        try {
            const queryString = new URLSearchParams(params).toString();
            const response = await fetch(`${adminCore.apiBaseUrl}/admin/reports/user-growth?${queryString}`, {
                headers: adminCore.getAuthHeaders()
            });
            
            if (!response.ok) throw new Error('Failed to fetch growth data');
            
            return await response.json();
            
        } catch (error) {
            console.error('Fetch growth data error:', error);
            return this.getMockGrowthData();
        }
    }

    /**
     * Fetch match data
     */
    async fetchMatchData(params) {
        try {
            const queryString = new URLSearchParams(params).toString();
            const response = await fetch(`${adminCore.apiBaseUrl}/admin/reports/match-analytics?${queryString}`, {
                headers: adminCore.getAuthHeaders()
            });
            
            if (!response.ok) throw new Error('Failed to fetch match data');
            
            return await response.json();
            
        } catch (error) {
            console.error('Fetch match data error:', error);
            return this.getMockMatchData();
        }
    }

    /**
     * Fetch engagement data
     */
    async fetchEngagementData(params) {
        try {
            const queryString = new URLSearchParams(params).toString();
            const response = await fetch(`${adminCore.apiBaseUrl}/admin/reports/engagement?${queryString}`, {
                headers: adminCore.getAuthHeaders()
            });
            
            if (!response.ok) throw new Error('Failed to fetch engagement data');
            
            return await response.json();
            
        } catch (error) {
            console.error('Fetch engagement data error:', error);
            return this.getMockEngagementData();
        }
    }

    /**
     * Fetch LGA data
     */
    async fetchLGAData(params) {
        try {
            const queryString = new URLSearchParams(params).toString();
            const response = await fetch(`${adminCore.apiBaseUrl}/admin/reports/lga-performance?${queryString}`, {
                headers: adminCore.getAuthHeaders()
            });
            
            if (!response.ok) throw new Error('Failed to fetch LGA data');
            
            return await response.json();
            
        } catch (error) {
            console.error('Fetch LGA data error:', error);
            return this.getMockLGAData();
        }
    }

    /**
     * Update key metrics cards
     */
    updateKeyMetrics(metrics) {
        const metricCards = [
            { 
                id: 'active_users', 
                value: metrics.active_users || 0, 
                label: 'Active Users', 
                icon: 'trending_up', 
                color: '#3b82f6',
                change: metrics.active_users_change || 0
            },
            { 
                id: 'new_registrations', 
                value: metrics.new_registrations || 0, 
                label: 'New Registrations', 
                icon: 'people', 
                color: '#10b981',
                change: metrics.new_registrations_change || 0
            },
            { 
                id: 'total_matches', 
                value: metrics.total_matches || 0, 
                label: 'Total Matches', 
                icon: 'favorite', 
                color: '#f59e0b',
                change: metrics.total_matches_change || 0
            },
            { 
                id: 'messages_sent', 
                value: metrics.messages_sent || 0, 
                label: 'Messages Sent', 
                icon: 'message', 
                color: '#ec4899',
                change: metrics.messages_sent_change || 0
            },
            { 
                id: 'profile_views', 
                value: metrics.profile_views || 0, 
                label: 'Profile Views', 
                icon: 'visibility', 
                color: '#8b5cf6',
                change: metrics.profile_views_change || 0
            },
            { 
                id: 'engagement_rate', 
                value: metrics.engagement_rate || 0, 
                label: 'Engagement Rate', 
                icon: 'emoji_emotions', 
                color: '#22c55e',
                change: metrics.engagement_rate_change || 0
            }
        ];

        $('#keyMetricsGrid').html(
            metricCards.map(metric => this.createMetricCardHTML(metric)).join('')
        );
    }

    /**
     * Create metric card HTML
     */
    createMetricCardHTML(metric) {
        const trendClass = metric.change >= 0 ? 'trend-up' : 'trend-down';
        const trendIcon = metric.change >= 0 ? 'trending_up' : 'trending_down';
        const changeText = metric.change >= 0 ? `+${metric.change}%` : `${metric.change}%`;
        const periodText = metric.id === 'engagement_rate' ? 'improvement' : 'from last period';
        
        const displayValue = metric.id === 'engagement_rate' 
            ? `${metric.value}%` 
            : metric.value.toLocaleString();
        
        return `
            <div class="stat-card">
                <div class="stat-icon" style="background: ${adminCore.lightenColor(metric.color, 0.9)}; color: ${metric.color};">
                    <i class="material-icons">${metric.icon}</i>
                </div>
                <div class="stat-value">${displayValue}</div>
                <div class="stat-label">${metric.label}</div>
                <div class="stat-trend ${trendClass}">
                    <i class="material-icons">${trendIcon}</i>
                    <span>${changeText} ${periodText}</span>
                </div>
            </div>
        `;
    }

    /**
     * Render all charts
     */
    renderCharts() {
        this.renderUserGrowthChart();
        this.renderMatchSuccessChart();
        this.renderEngagementTimeChart();
        this.renderLGAPerformanceChart();
        this.renderDemographicsChart();
    }

    /**
     * Render user growth chart
     */
    renderUserGrowthChart() {
        const ctx = document.getElementById('userGrowthChart');
        if (!ctx) return;
        
        if (this.charts.userGrowth) {
            this.charts.userGrowth.destroy();
        }
        
        const data = this.reportData.growthData;
        const chartType = this.chartTypes.userGrowth || 'line';
        
        this.charts.userGrowth = new Chart(ctx, {
            type: chartType,
            data: {
                labels: data.labels || this.generateDateLabels(),
                datasets: [
                    {
                        label: 'New Users',
                        data: data.new_users || this.generateRandomData(),
                        borderColor: '#10b981',
                        backgroundColor: chartType === 'bar' ? 'rgba(16, 185, 129, 0.7)' : 'rgba(16, 185, 129, 0.1)',
                        borderWidth: 2,
                        fill: chartType === 'line',
                        tension: 0.4
                    },
                    {
                        label: 'Active Users',
                        data: data.active_users || this.generateRandomData(),
                        borderColor: '#3b82f6',
                        backgroundColor: chartType === 'bar' ? 'rgba(59, 130, 246, 0.7)' : 'rgba(59, 130, 246, 0.1)',
                        borderWidth: 2,
                        fill: chartType === 'line',
                        tension: 0.4
                    }
                ]
            },
            options: this.getChartOptions('User Growth')
        });
    }

    /**
     * Render match success chart
     */
    renderMatchSuccessChart() {
        const ctx = document.getElementById('matchSuccessChart');
        if (!ctx) return;
        
        if (this.charts.matchSuccess) {
            this.charts.matchSuccess.destroy();
        }
        
        const data = this.reportData.matchData;
        const chartType = this.chartTypes.matchSuccess || 'doughnut';
        
        this.charts.matchSuccess = new Chart(ctx, {
            type: chartType,
            data: {
                labels: ['Successful Matches', 'Failed Matches', 'Pending'],
                datasets: [{
                    data: [
                        data.successful_matches || 45,
                        data.failed_matches || 35,
                        data.pending_matches || 20
                    ],
                    backgroundColor: ['#10b981', '#ef4444', '#f59e0b'],
                    borderWidth: 1,
                    borderColor: '#fff'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: {
                            padding: 20,
                            usePointStyle: true
                        }
                    }
                },
                cutout: chartType === 'doughnut' ? '60%' : undefined
            }
        });
    }

    /**
     * Render engagement time chart
     */
    renderEngagementTimeChart() {
        const ctx = document.getElementById('engagementTimeChart');
        if (!ctx) return;
        
        if (this.charts.engagementTime) {
            this.charts.engagementTime.destroy();
        }
        
        const data = this.reportData.engagementData;
        const chartType = this.chartTypes.engagementTime || 'bar';
        
        this.charts.engagementTime = new Chart(ctx, {
            type: chartType,
            data: {
                labels: ['6AM-9AM', '9AM-12PM', '12PM-3PM', '3PM-6PM', '6PM-9PM', '9PM-12AM'],
                datasets: [{
                    label: 'User Activity',
                    data: data.time_distribution || [30, 45, 55, 65, 85, 60],
                    backgroundColor: 'rgba(139, 92, 246, 0.7)',
                    borderColor: '#8b5cf6',
                    borderWidth: 1
                }]
            },
            options: this.getChartOptions('User Engagement by Time')
        });
    }

    /**
     * Render LGA performance chart
     */
    renderLGAPerformanceChart() {
        const ctx = document.getElementById('lgaPerformanceChart');
        if (!ctx) return;
        
        if (this.charts.lgaPerformance) {
            this.charts.lgaPerformance.destroy();
        }
        
        const data = this.reportData.lgaData;
        const chartType = this.chartTypes.lgaPerformance || 'bar';
        
        this.charts.lgaPerformance = new Chart(ctx, {
            type: chartType,
            data: {
                labels: data.top_lgas?.map(lga => lga.name) || ['Uyo', 'Eket', 'Ikot Ekpene', 'Oron', 'Etinan'],
                datasets: [{
                    label: 'User Count',
                    data: data.top_lgas?.map(lga => lga.users) || [150, 120, 90, 80, 70],
                    backgroundColor: 'rgba(236, 72, 153, 0.7)',
                    borderColor: '#ec4899',
                    borderWidth: 1
                }]
            },
            options: this.getChartOptions('LGA Performance')
        });
    }

    /**
     * Render demographics chart
     */
    renderDemographicsChart() {
        const ctx = document.getElementById('demographicsChart');
        if (!ctx) return;
        
        if (this.charts.demographics) {
            this.charts.demographics.destroy();
        }
        
        const filterType = $('#demographicFilter').val();
        let chartData;
        
        switch (filterType) {
            case 'age':
                chartData = {
                    labels: ['18-25', '25-30', '30-35', '35-40', '40+'],
                    data: [35, 28, 20, 12, 5]
                };
                break;
            case 'education':
                chartData = {
                    labels: ['High School', 'Bachelor\'s', 'Master\'s', 'PhD', 'Other'],
                    data: [15, 45, 30, 5, 5]
                };
                break;
            case 'profession':
                chartData = {
                    labels: ['Student', 'Professional', 'Business', 'Government', 'Other'],
                    data: [20, 40, 25, 10, 5]
                };
                break;
            case 'income':
                chartData = {
                    labels: ['< ₦100k', '₦100k-₦500k', '₦500k-₦1M', '₦1M-₦5M', '> ₦5M'],
                    data: [25, 45, 20, 8, 2]
                };
                break;
        }
        
        this.charts.demographics = new Chart(ctx, {
            type: this.chartTypes.demographics || 'bar',
            data: {
                labels: chartData.labels,
                datasets: [{
                    label: 'Percentage',
                    data: chartData.data,
                    backgroundColor: 'rgba(16, 185, 129, 0.7)',
                    borderColor: '#10b981',
                    borderWidth: 1
                }]
            },
            options: this.getChartOptions('User Demographics')
        });
    }

    /**
     * Get chart options
     */
    getChartOptions(title) {
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    labels: {
                        padding: 10
                    }
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleFont: { size: 12 },
                    bodyFont: { size: 12 },
                    padding: 10
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: {
                        color: 'rgba(0,0,0,0.05)'
                    },
                    ticks: {
                        precision: 0
                    }
                },
                x: {
                    grid: {
                        color: 'rgba(0,0,0,0.05)'
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'nearest'
            },
            animation: {
                duration: 1000,
                easing: 'easeOutQuart'
            }
        };
    }

    /**
     * Update LGA performance table
     */
    updateLGATable(lgaData) {
        const $tableBody = $('#lgaPerformanceTable');
        
        if (!lgaData.top_lgas || lgaData.top_lgas.length === 0) {
            $tableBody.html(this.getEmptyTableHTML('No LGA data available'));
            return;
        }
        
        $tableBody.html(
            lgaData.top_lgas.map((lga, index) => this.createLGATableRow(lga, index + 1)).join('')
        );
    }

    /**
     * Create LGA table row
     */
    createLGATableRow(lga, rank) {
        const trendIcon = lga.growth >= 0 ? 'trending_up' : 'trending_down';
        const trendClass = lga.growth >= 0 ? 'trend-up' : 'trend-down';
        const growthText = lga.growth >= 0 ? `+${lga.growth}%` : `${lga.growth}%`;
        
        return `
            <tr>
                <td>${rank}</td>
                <td><strong>${lga.name}</strong></td>
                <td>${lga.total_users?.toLocaleString() || 0}</td>
                <td>${lga.active_users?.toLocaleString() || 0}</td>
                <td>${lga.match_rate || 0}%</td>
                <td>${lga.success_rate || 0}%</td>
                <td>${growthText}</td>
                <td>
                    <div class="stat-trend ${trendClass}">
                        <i class="material-icons">${trendIcon}</i>
                    </div>
                </td>
            </tr>
        `;
    }

    /**
     * Generate insights
     */
    generateInsights() {
        const data = this.reportData.metrics;
        
        // Key Insights
        const keyInsights = [
            `Active users increased by ${data.active_users_change || 0}% compared to last period`,
            `New registrations peaked on ${this.getPeakDay()}`,
            `Engagement rate is ${data.engagement_rate || 0}%, showing healthy user interaction`,
            `Match success rate improved by ${data.match_success_change || 0}%`
        ];
        
        $('#keyInsights').html(this.createInsightsListHTML(keyInsights));
        
        // Areas for Improvement
        const improvementAreas = [
            'User retention after 30 days could be improved',
            'Evening engagement drops significantly after 9 PM',
            'Certain LGAs show lower match success rates',
            'Profile completion rate is below target'
        ];
        
        $('#improvementAreas').html(this.createInsightsListHTML(improvementAreas));
        
        // Recommendations
        const recommendations = [
            'Implement targeted engagement campaigns in low-performing LGAs',
            'Introduce evening chat prompts to boost after-hours activity',
            'Add profile completion incentives',
            'Optimize matching algorithm for better success rates'
        ];
        
        $('#recommendations').html(this.createInsightsListHTML(recommendations));
    }

    /**
     * Create insights list HTML
     */
    createInsightsListHTML(items) {
        return `
            <ul>
                ${items.map(item => `<li>${item}</li>`).join('')}
            </ul>
        `;
    }

    /**
     * Update report summary
     */
    updateReportSummary() {
        const data = this.reportData.metrics;
        const period = $('#reportPeriod').text();
        
        const summary = `
            <p>During the period ${period}, the platform showed strong performance with significant growth in key metrics.</p>
            <p><strong>Key Highlights:</strong></p>
            <ul>
                <li>Active users reached ${data.active_users?.toLocaleString() || 0}, a ${data.active_users_change || 0}% increase</li>
                <li>${data.new_registrations?.toLocaleString() || 0} new users joined the platform</li>
                <li>Match success rate improved to ${data.match_success_rate || 0}%</li>
                <li>Total messages sent: ${data.messages_sent?.toLocaleString() || 0}</li>
            </ul>
            <p>The engagement rate of ${data.engagement_rate || 0}% indicates healthy user interaction and platform stickiness.</p>
        `;
        
        $('#reportSummary').html(summary);
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Apply filters button
        $('#applyReportFiltersBtn').on('click', () => this.loadReportData());
        
        // Export PDF button
        $('#exportReportBtn').on('click', () => this.generatePDFReport());
        
        // Generate report button
        $('#generateReportBtn').on('click', () => this.openReportModal());
        
        // Confirm generate report button
        $('#confirmGenerateReportBtn').on('click', () => this.generateCustomReport());
        
        // Demographic filter change
        $('#demographicFilter').on('change', () => this.renderDemographicsChart());
        
        // Report type change
        $('#reportType').on('change', () => this.loadReportData());
        
        // Granularity change
        $('#granularity').on('change', () => this.loadReportData());
    }

    /**
     * Toggle chart type
     */
    toggleChartType(button) {
        const chartName = $(button).data('chart');
        const currentType = this.chartTypes[chartName];
        
        // Cycle through chart types
        const types = ['line', 'bar', 'pie', 'doughnut'];
        const currentIndex = types.indexOf(currentType);
        const nextIndex = (currentIndex + 1) % types.length;
        
        this.chartTypes[chartName] = types[nextIndex];
        
        // Update button icon
        const icons = {
            'line': 'show_chart',
            'bar': 'bar_chart',
            'pie': 'pie_chart',
            'doughnut': 'donut_large'
        };
        
        $(button).find('i').text(icons[this.chartTypes[chartName]]);
        
        // Re-render the chart
        switch(chartName) {
            case 'userGrowth':
                this.renderUserGrowthChart();
                break;
            case 'matchSuccess':
                this.renderMatchSuccessChart();
                break;
            case 'engagementTime':
                this.renderEngagementTimeChart();
                break;
            case 'lgaPerformance':
                this.renderLGAPerformanceChart();
                break;
        }
    }

    /**
     * Download chart as image
     */
    downloadChart(chartId) {
        const chart = this.charts[chartId.replace('Chart', '')];
        if (!chart) return;
        
        const link = document.createElement('a');
        link.download = `${chartId}.png`;
        link.href = chart.toBase64Image();
        link.click();
    }

    /**
     * Open report generation modal
     */
    openReportModal() {
        this.reportModal.open();
    }

    /**
     * Generate custom report
     */
    async generateCustomReport() {
        const title = $('#reportTitle').val() || 'Akwa-Connect Analytics Report';
        const format = $('#reportFormat').val();
        
        adminCore.showLoading();
        adminCore.showToast(`Generating ${format.toUpperCase()} report...`, 'info');
        
        // Simulate report generation
        setTimeout(() => {
            adminCore.hideLoading();
            adminCore.showToast(`Report "${title}" generated successfully!`, 'success');
            this.reportModal.close();
            
            // Reset form
            $('#reportTitle').val('');
            $('#reportDescription').val('');
            
        }, 2000);
    }

    /**
     * Generate PDF report
     */
    generatePDFReport() {
        adminCore.showLoading();
        adminCore.showToast('Generating PDF report...', 'info');
        
        // Simulate PDF generation
        setTimeout(() => {
            adminCore.hideLoading();
            adminCore.showToast('PDF report downloaded successfully!', 'success');
            
            // Create download link
            const link = document.createElement('a');
            link.download = `Akwa-Connect-Report-${moment().format('YYYY-MM-DD')}.pdf`;
            link.href = '#';
            link.click();
        }, 1500);
    }

    /**
     * Export table data
     */
    exportTableData() {
        adminCore.showToast('Exporting table data...', 'info');
        
        // Create CSV data
        const headers = ['Rank', 'LGA', 'Total Users', 'Active Users', 'Match Rate', 'Success Rate', 'Growth'];
        const rows = [];
        
        $('#lgaPerformanceTable tr').each((index, row) => {
            if (index === 0) return; // Skip header
            
            const cells = $(row).find('td');
            if (cells.length > 0) {
                const rowData = [
                    $(cells[0]).text(),
                    $(cells[1]).text(),
                    $(cells[2]).text().replace(/,/g, ''),
                    $(cells[3]).text().replace(/,/g, ''),
                    $(cells[4]).text().replace('%', ''),
                    $(cells[5]).text().replace('%', ''),
                    $(cells[6]).text().replace('%', '')
                ];
                rows.push(rowData);
            }
        });
        
        // Convert to CSV
        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.join(','))
        ].join('\n');
        
        // Create download link
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        const url = URL.createObjectURL(blob);
        
        link.setAttribute('href', url);
        link.setAttribute('download', `lga-performance-${moment().format('YYYY-MM-DD')}.csv`);
        link.style.visibility = 'hidden';
        
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        adminCore.showToast('Table data exported successfully!', 'success');
    }

    /**
     * Generate date labels
     */
    generateDateLabels() {
        const labels = [];
        const days = this.dateRange.end.diff(this.dateRange.start, 'days');
        
        for (let i = 0; i <= days; i++) {
            const date = moment(this.dateRange.start).add(i, 'days');
            labels.push(date.format('MMM D'));
        }
        
        return labels;
    }

    /**
     * Generate random data
     */
    generateRandomData() {
        const days = this.dateRange.end.diff(this.dateRange.start, 'days') + 1;
        const data = [];
        let lastValue = 50;
        
        for (let i = 0; i < days; i++) {
            const change = Math.floor(Math.random() * 20) - 5;
            lastValue = Math.max(0, lastValue + change);
            data.push(lastValue);
        }
        
        return data;
    }

    /**
     * Get peak day
     */
    getPeakDay() {
        const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        return days[Math.floor(Math.random() * days.length)];
    }

    /**
     * Get mock metrics
     */
    getMockMetrics() {
        return {
            active_users: 1250,
            active_users_change: 12,
            new_registrations: 245,
            new_registrations_change: 8,
            total_matches: 567,
            total_matches_change: 15,
            messages_sent: 3421,
            messages_sent_change: 22,
            profile_views: 8923,
            profile_views_change: 18,
            engagement_rate: 68,
            engagement_rate_change: 5,
            match_success_rate: 45,
            match_success_change: 3
        };
    }

    /**
     * Get mock growth data
     */
    getMockGrowthData() {
        return {
            labels: this.generateDateLabels(),
            new_users: this.generateRandomData(),
            active_users: this.generateRandomData()
        };
    }

    /**
     * Get mock match data
     */
    getMockMatchData() {
        return {
            successful_matches: 45,
            failed_matches: 35,
            pending_matches: 20
        };
    }

    /**
     * Get mock engagement data
     */
    getMockEngagementData() {
        return {
            time_distribution: [30, 45, 55, 65, 85, 60]
        };
    }

    /**
     * Get mock LGA data
     */
    getMockLGAData() {
        return {
            top_lgas: [
                { name: 'Uyo', total_users: 150, active_users: 120, match_rate: 65, success_rate: 45, growth: 12 },
                { name: 'Eket', total_users: 120, active_users: 95, match_rate: 58, success_rate: 42, growth: 8 },
                { name: 'Ikot Ekpene', total_users: 90, active_users: 70, match_rate: 52, success_rate: 38, growth: 5 },
                { name: 'Oron', total_users: 80, active_users: 65, match_rate: 48, success_rate: 35, growth: 3 },
                { name: 'Etinan', total_users: 70, active_users: 55, match_rate: 45, success_rate: 32, growth: -2 }
            ]
        };
    }

    /**
     * Get empty table HTML
     */
    getEmptyTableHTML(message) {
        return `
            <tr>
                <td colspan="8" class="empty-state">
                    <i class="material-icons">group_off</i>
                    <p>${message}</p>
                </td>
            </tr>
        `;
    }
}

// Initialize AdminReports
window.adminReports = new AdminReports();