class ImageCompressor {
    constructor() {
        this.processedImages = [];
        this.init();
    }

    init() {
        try {
            this.bindEvents();
        } catch (error) {
            console.error('Initialization error:', error);
            this.showAlert('初期化中にエラーが発生しました', 'error');
        }
    }

    bindEvents() {
        const dropzone = document.getElementById('dropzone');
        const fileInput = document.getElementById('fileInput');
        const selectFilesBtn = document.getElementById('selectFilesBtn');
        const downloadBtn = document.getElementById('downloadBtn');
        
        if (!dropzone || !fileInput || !selectFilesBtn || !downloadBtn) {
            throw new Error('Required DOM elements not found');
        }

        dropzone.addEventListener('dragenter', this.handleDragEnter.bind(this));
        dropzone.addEventListener('dragover', this.handleDragOver.bind(this));
        dropzone.addEventListener('dragleave', this.handleDragLeave.bind(this));
        dropzone.addEventListener('drop', this.handleDrop.bind(this));
        dropzone.addEventListener('click', (e) => {
            if (e.target.id === 'selectFilesBtn' || e.target.closest('#selectFilesBtn')) {
                return;
            }
            fileInput.click();
        });
        
        // Add active class on drag events
        dropzone.addEventListener('dragenter', (e) => {
            e.preventDefault();
            dropzone.classList.add('c-upload-zone--active');
        });
        
        dropzone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            // Only remove if leaving the dropzone completely
            const rect = dropzone.getBoundingClientRect();
            if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
                dropzone.classList.remove('c-upload-zone--active');
            }
        });

        selectFilesBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            fileInput.click();
        });

        fileInput.addEventListener('change', this.handleFileSelect.bind(this));
        downloadBtn.addEventListener('click', this.downloadAsZip.bind(this));
    }

    handleDragEnter(e) {
        e.preventDefault();
        e.stopPropagation();
        document.getElementById('dropzone').classList.add('c-upload-zone--active');
    }

    handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        document.getElementById('dropzone').classList.add('c-upload-zone--active');
    }

    handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        const dropzone = document.getElementById('dropzone');
        const rect = dropzone.getBoundingClientRect();
        const x = e.clientX;
        const y = e.clientY;
        
        if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
            dropzone.classList.remove('c-upload-zone--active');
        }
    }

    handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        document.getElementById('dropzone').classList.remove('c-upload-zone--active');
        
        const files = Array.from(e.dataTransfer.files).filter(file => 
            file.type.startsWith('image/') || 
            file.name.toLowerCase().endsWith('.heic') ||
            file.name.toLowerCase().endsWith('.heif')
        );
        
        if (files.length === 0) {
            this.showAlert('画像ファイルを選択してください。', 'error');
            return;
        }

        this.processFiles(files);
    }

    handleFileSelect(e) {
        const files = Array.from(e.target.files).filter(file => 
            file.type.startsWith('image/') || 
            file.name.toLowerCase().endsWith('.heic') ||
            file.name.toLowerCase().endsWith('.heif')
        );
        
        if (files.length === 0) {
            this.showAlert('画像ファイルを選択してください。', 'error');
            return;
        }
        
        this.processFiles(files);
        e.target.value = '';
    }

    async processFiles(files) {
        if (!files || files.length === 0) {
            this.showAlert('処理するファイルがありません。', 'error');
            return;
        }

        this.showLoading();
        this.clearResults();
        this.processedImages = [];

        const outputFormat = 'original'; // Always use original format

        for (const file of files) {
            try {
                let processFile = file;
                
                // HEICファイルの場合は先にJPEGに変換
                if (this.isHeicFile(file)) {
                    try {
                        this.showAlert(`${file.name}をJPEGに変換中...`, 'info');
                        processFile = await this.convertHeicToJpeg(file);
                        this.showAlert(`${file.name}の変換が完了しました`, 'success');
                    } catch (heicError) {
                        console.error('HEIC conversion error:', heicError);
                        this.processedImages.push({
                            originalFile: file,
                            error: true,
                            errorMessage: 'HEICファイルの変換に失敗しました。'
                        });
                        continue;
                    }
                }
                
                const result = await this.compressImage(processFile, outputFormat);
                this.processedImages.push(result);
            } catch (error) {
                console.error('Compression error:', error);
                this.processedImages.push({
                    originalFile: file,
                    error: true,
                    errorMessage: '読み取れませんでした。再度お試しください。'
                });
            }
        }

        this.hideLoading();
        this.displayResults();
        this.showDownloadSection();
    }

    async compressImage(file, outputFormat) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            
            // 30秒でタイムアウト
            const timeout = setTimeout(() => {
                reject(new Error('画像処理がタイムアウトしました'));
            }, 30000);

            img.onload = () => {
                try {
                    // 高品質設定: より大きなサイズを許可
                    const maxWidth = 3840;  // 4K対応
                    const maxHeight = 2160; // 4K対応
                    
                    let { width, height } = this.calculateDimensions(
                        img.width, 
                        img.height, 
                        maxWidth, 
                        maxHeight
                    );

                    // 元画像が小さい場合はリサイズしない
                    if (img.width <= maxWidth && img.height <= maxHeight) {
                        width = img.width;
                        height = img.height;
                    }

                    canvas.width = width;
                    canvas.height = height;
                    
                    // 高品質レンダリング設定
                    ctx.imageSmoothingEnabled = true;
                    ctx.imageSmoothingQuality = 'high';
                    
                    ctx.drawImage(img, 0, 0, width, height);

                    let mimeType = file.type;
                    let quality = 0.95; // デフォルト高品質
                    let extension = this.getFileExtension(file.name);

                    if (outputFormat === 'webp') {
                        mimeType = 'image/webp';
                        extension = 'webp';
                        quality = 0.92; // WebPでも高品質
                    } else if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
                        quality = 0.95; // JPEG最高品質
                    } else if (mimeType === 'image/png') {
                        quality = 1.0;  // PNG最高品質（ロスレス）
                    }

                    canvas.toBlob((blob) => {
                        clearTimeout(timeout);
                        
                        if (!blob) {
                            reject(new Error('圧縮に失敗しました'));
                            return;
                        }

                        const originalSize = file.size;
                        const compressedSize = blob.size;
                        const compressionRatio = ((originalSize - compressedSize) / originalSize * 100).toFixed(1);
                        
                        const newFileName = this.generateFileName(file.name, extension);

                        resolve({
                            originalFile: file,
                            compressedBlob: blob,
                            originalSize: originalSize,
                            compressedSize: compressedSize,
                            compressionRatio: compressionRatio,
                            fileName: newFileName,
                            mimeType: mimeType
                        });
                    }, mimeType, quality);
                } catch (error) {
                    clearTimeout(timeout);
                    reject(error);
                }
            };

            img.onerror = () => {
                clearTimeout(timeout);
                reject(new Error('画像の読み込みに失敗しました'));
            };

            img.src = URL.createObjectURL(file);
        });
    }

    calculateDimensions(originalWidth, originalHeight, maxWidth, maxHeight) {
        let width = originalWidth;
        let height = originalHeight;

        if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
        }

        if (height > maxHeight) {
            width = (width * maxHeight) / height;
            height = maxHeight;
        }

        return { width: Math.round(width), height: Math.round(height) };
    }

    generateFileName(originalName, extension) {
        const nameWithoutExt = originalName.replace(/\.[^/.]+$/, '');
        return `${nameWithoutExt}_compressed.${extension}`;
    }

    getFileExtension(fileName) {
        return fileName.split('.').pop().toLowerCase();
    }

    displayResults() {
        const resultsList = document.getElementById('resultsList');
        const resultsArea = document.getElementById('resultsArea');
        
        resultsList.innerHTML = '';
        
        this.processedImages.forEach((result, index) => {
            const resultItem = document.createElement('div');
            
            if (result.error) {
                resultItem.className = 'p-image-compressor__result-item p-image-compressor__result-item--error';
                resultItem.innerHTML = `
                    <div class="p-image-compressor__result-info">
                        <div class="p-image-compressor__result-name">${result.originalFile.name}</div>
                        <div class="c-alert c-alert--error">
                            <div class="c-alert__content">
                                <p class="c-alert__message">${result.errorMessage}</p>
                            </div>
                        </div>
                    </div>
                `;
            } else {
                const compressionRatioClass = this.getCompressionRatioClass(result.compressionRatio);
                
                resultItem.className = 'p-image-compressor__result-item';
                resultItem.innerHTML = `
                    <div class="p-image-compressor__result-info">
                        <div class="p-image-compressor__result-name">${result.fileName}</div>
                        <div class="p-image-compressor__result-stats">
                            <div class="p-image-compressor__result-stat">
                                <span>元のサイズ:</span>
                                <span>${this.formatFileSize(result.originalSize)}</span>
                            </div>
                            <div class="p-image-compressor__result-stat">
                                <span>圧縮後:</span>
                                <span>${this.formatFileSize(result.compressedSize)}</span>
                            </div>
                        </div>
                    </div>
                    <div class="p-image-compressor__compression-ratio p-image-compressor__compression-ratio--${compressionRatioClass}">
                        ${result.compressionRatio}% 圧縮
                    </div>
                `;
            }
            
            resultsList.appendChild(resultItem);
        });
        
        resultsArea.classList.remove('u-display-none');
    }

    getCompressionRatioClass(ratio) {
        const numRatio = parseFloat(ratio);
        if (numRatio >= 50) return 'excellent';
        if (numRatio >= 30) return 'good';
        return 'fair';
    }

    showDownloadSection() {
        const successfulImages = this.processedImages.filter(img => !img.error);
        
        if (successfulImages.length === 0) {
            return;
        }

        const totalOriginalSize = successfulImages.reduce((sum, img) => sum + img.originalSize, 0);
        const totalCompressedSize = successfulImages.reduce((sum, img) => sum + img.compressedSize, 0);
        const totalCompressionRatio = ((totalOriginalSize - totalCompressedSize) / totalOriginalSize * 100).toFixed(1);

        document.getElementById('totalFiles').textContent = successfulImages.length;
        document.getElementById('totalOriginalSize').textContent = this.formatFileSize(totalOriginalSize);
        document.getElementById('totalCompressedSize').textContent = this.formatFileSize(totalCompressedSize);
        document.getElementById('totalCompressionRatio').textContent = `${totalCompressionRatio}%`;

        document.getElementById('downloadSection').classList.remove('u-display-none');
    }

    async downloadAsZip() {
        const downloadBtn = document.getElementById('downloadBtn');
        const originalText = downloadBtn.querySelector('.c-button__text').textContent;
        
        downloadBtn.classList.add('c-button--loading');
        downloadBtn.disabled = true;
        downloadBtn.querySelector('.c-button__text').textContent = '準備中...';

        try {
            const JSZip = await this.loadJSZip();
            const zip = new JSZip();

            const successfulImages = this.processedImages.filter(img => !img.error);

            // 圧縮済み画像のみを追加
            successfulImages.forEach((result) => {
                zip.file(result.fileName, result.compressedBlob);
            });

            const content = await zip.generateAsync({ type: 'blob' });
            
            const now = new Date();
            const timestamp = now.toISOString().slice(0, 19).replace(/[-:T]/g, '').slice(0, 14);
            const filename = `compressed_images_${timestamp}.zip`;

            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);

            this.showAlert(`${successfulImages.length}個のファイルをダウンロードしました`, 'success');
        } catch (error) {
            console.error('ZIP creation error:', error);
            this.showAlert('ZIPファイルの作成に失敗しました', 'error');
        } finally {
            downloadBtn.classList.remove('c-button--loading');
            downloadBtn.disabled = false;
            downloadBtn.querySelector('.c-button__text').textContent = originalText;
        }
    }

    async loadJSZip() {
        if (window.JSZip) {
            return Promise.resolve(window.JSZip);
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
            script.onload = () => resolve(window.JSZip);
            script.onerror = () => reject(new Error('JSZip library could not be loaded'));
            document.head.appendChild(script);
        });
    }


    async loadHeic2Any() {
        if (window.heic2any) {
            return Promise.resolve(window.heic2any);
        }

        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/heic2any@0.0.4/dist/heic2any.min.js';
            script.onload = () => resolve(window.heic2any);
            script.onerror = () => reject(new Error('heic2any library could not be loaded'));
            document.head.appendChild(script);
        });
    }

    async convertHeicToJpeg(file) {
        try {
            const heic2any = await this.loadHeic2Any();
            const convertedBlob = await heic2any({
                blob: file,
                toType: 'image/jpeg',
                quality: 0.95
            });
            
            // Blobを配列で返す場合があるので確認
            const resultBlob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;
            
            // 新しいFileオブジェクトを作成
            const newFileName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
            return new File([resultBlob], newFileName, { type: 'image/jpeg' });
        } catch (error) {
            console.error('HEIC conversion error:', error);
            throw new Error('HEICファイルの変換に失敗しました');
        }
    }

    isHeicFile(file) {
        return file.name.toLowerCase().endsWith('.heic') || 
               file.name.toLowerCase().endsWith('.heif') ||
               file.type === 'image/heic' ||
               file.type === 'image/heif';
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    showAlert(message, type = 'info') {
        const alertArea = document.getElementById('alertArea');
        const alertId = 'alert_' + Date.now();
        
        const iconMap = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };

        const alertElement = document.createElement('div');
        alertElement.id = alertId;
        alertElement.className = `c-alert c-alert--${type} c-alert--dismissible`;
        alertElement.innerHTML = `
            <div class="c-alert__icon">${iconMap[type] || iconMap.info}</div>
            <div class="c-alert__content">
                <p class="c-alert__message">${message}</p>
            </div>
            <button type="button" class="c-alert__close" onclick="this.parentElement.remove()">&times;</button>
        `;

        alertArea.appendChild(alertElement);

        setTimeout(() => {
            const alert = document.getElementById(alertId);
            if (alert) {
                alert.remove();
            }
        }, 5000);
    }

    showLoading() {
        document.getElementById('loadingIndicator').classList.remove('u-display-none');
    }

    hideLoading() {
        document.getElementById('loadingIndicator').classList.add('u-display-none');
    }

    clearResults() {
        document.getElementById('resultsArea').classList.add('u-display-none');
        document.getElementById('downloadSection').classList.add('u-display-none');
        document.getElementById('resultsList').innerHTML = '';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ImageCompressor();
});