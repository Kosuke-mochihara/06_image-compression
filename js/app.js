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
        const folderInput = document.getElementById('folderInput');
        const selectFilesBtn = document.getElementById('selectFilesBtn');
        const selectFolderBtn = document.getElementById('selectFolderBtn');
        const downloadBtn = document.getElementById('downloadBtn');
        
        if (!dropzone || !fileInput || !folderInput || !selectFilesBtn || !selectFolderBtn || !downloadBtn) {
            throw new Error('Required DOM elements not found');
        }

        dropzone.addEventListener('dragenter', this.handleDragEnter.bind(this));
        dropzone.addEventListener('dragover', this.handleDragOver.bind(this));
        dropzone.addEventListener('dragleave', this.handleDragLeave.bind(this));
        dropzone.addEventListener('drop', this.handleDrop.bind(this));
        // ドロップゾーンのクリックイベントをより厳密に制御
        dropzone.addEventListener('click', (e) => {
            console.log('Dropzone click event:', e.target);
            
            // ボタンまたはその子要素がクリックされた場合は何もしない
            if (e.target.closest('button') || e.target.closest('.c-button')) {
                console.log('Button or button child clicked, ignoring');
                return;
            }
            
            // input要素がクリックされた場合も何もしない
            if (e.target.tagName === 'INPUT') {
                console.log('Input clicked, ignoring');
                return;
            }
            
            // ボタンコンテナ内のクリックは無視
            if (e.target.closest('.c-upload-zone__buttons')) {
                console.log('Button container clicked, ignoring');
                return;
            }
            
            // ドロップゾーン領域の空白部分がクリックされた場合のみファイル選択を開く
            console.log('Dropzone area clicked, opening file dialog');
            setTimeout(() => fileInput.click(), 0);
        });
        

        // キャプチャーフェーズでボタンイベントを処理（より確実）
        selectFilesBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            console.log('Files button clicked');
            setTimeout(() => fileInput.click(), 0);
        }, true);
        
        selectFolderBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();
            console.log('Folder button clicked');
            setTimeout(() => folderInput.click(), 0);
        }, true);
        
        folderInput.addEventListener('change', this.handleFolderSelect.bind(this));

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

    async handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        document.getElementById('dropzone').classList.remove('c-upload-zone--active');
        
        // DataTransferItemsを使ってフォルダーを再帰的に処理
        const files = [];
        if (e.dataTransfer.items) {
            await this.traverseDataTransferItems(e.dataTransfer.items, files);
        } else {
            // フォールバック: 古いブラウザの場合
            files.push(...Array.from(e.dataTransfer.files));
        }
        
        const imageFiles = files.filter(file => this.isImageFile(file));
        
        if (imageFiles.length === 0) {
            if (files.length > 0) {
                this.showAlert(`選択された${files.length}個のファイルの中に画像ファイルが見つかりませんでした。対応形式: JPEG, PNG, GIF, BMP, TIFF, WebP, HEIC`, 'error');
            } else {
                this.showAlert('画像ファイルを選択してください。', 'error');
            }
            return;
        }

        this.showAlert(`${imageFiles.length}個の画像ファイルが見つかりました。`, 'success');
        this.processFiles(imageFiles);
    }

    handleFileSelect(e) {
        const files = Array.from(e.target.files).filter(file => 
            this.isImageFile(file)
        );
        
        if (files.length === 0) {
            const totalFiles = e.target.files.length;
            if (totalFiles > 0) {
                this.showAlert(`選択された${totalFiles}個のファイルの中に画像ファイルが見つかりませんでした。対応形式: JPEG, PNG, GIF, BMP, TIFF, WebP`, 'error');
            } else {
                this.showAlert('画像ファイルを選択してください。', 'error');
            }
            return;
        }
        
        this.processFiles(files);
        e.target.value = '';
    }

    handleFolderSelect(e) {
        const files = Array.from(e.target.files).filter(file => 
            this.isImageFile(file)
        );
        
        if (files.length === 0) {
            const totalFiles = e.target.files.length;
            if (totalFiles > 0) {
                this.showAlert(`選択された${totalFiles}個のファイルの中に画像ファイルが見つかりませんでした。対応形式: JPEG, PNG, GIF, BMP, TIFF, WebP`, 'error');
            } else {
                this.showAlert('フォルダ内に画像ファイルが見つかりません。', 'error');
            }
            return;
        }
        
        this.showAlert(`${files.length}個の画像ファイルが見つかりました。`, 'success');
        this.processFiles(files);
        e.target.value = '';
    }

    async processFiles(files) {
        if (!files || files.length === 0) {
            this.showAlert('処理するファイルがありません。', 'error');
            return;
        }

        // ファイルサイズ制限チェック (50MB)
        const maxSize = 50 * 1024 * 1024; // 50MB in bytes
        const oversizedFiles = files.filter(file => file.size > maxSize);
        if (oversizedFiles.length > 0) {
            this.showAlert(`ファイルサイズが大きすぎます。最大50MBまでです。`, 'error');
            return;
        }


        // ファイル数制限チェック (20ファイル)
        if (files.length > 20) {
            this.showAlert(`一度に処理できるファイル数は最大20ファイルです。`, 'error');
            return;
        }

        this.showLoading();
        this.clearResults();
        this.processedImages = [];

        const outputFormat = 'original'; // Always use original format

        // 進捗表示を初期化
        this.updateProgress(files.length, 0);
        
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            try {
                let processFile = file;
                
                // 現在処理中のファイル名を表示
                this.updateLoadingText(`${file.name} を処理中...`);
                
                // processFile = file (HEICファイルの変換処理は削除)
                
                const result = await this.compressImage(processFile, outputFormat);
                this.processedImages.push(result);
                
                // 進捗を更新
                this.updateProgress(files.length, i + 1);
            } catch (error) {
                console.error('Compression error:', error);
                this.processedImages.push({
                    originalFile: file,
                    error: true,
                    errorMessage: '読み取れませんでした。再度お試しください。'
                });
                // エラーの場合も進捗を更新
                this.updateProgress(files.length, i + 1);
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
            
            // セキュリティ: 30秒でタイムアウト（DoS対策）
            const timeout = setTimeout(() => {
                reject(new Error('画像処理がタイムアウトしました'));
            }, 30000);

            img.onload = () => {
                try {
                    // セキュリティチェック: 画像爆弾攻撃対策
                    const maxPixels = 50 * 1024 * 1024; // 50MP制限
                    const totalPixels = img.width * img.height;
                    
                    if (totalPixels > maxPixels) {
                        clearTimeout(timeout);
                        reject(new Error(`画像の解像度が大きすぎます (${img.width}x${img.height}). 最大50メガピクセルまで対応しています。`));
                        return;
                    }
                    
                    // 効果的な圧縮のための適切なサイズ制限
                    const maxWidth = 2560;  // 2.5K程度に制限
                    const maxHeight = 1440; // QHD程度に制限
                    
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
                    let quality = 0.8; // バランスの取れた品質設定
                    let extension = this.getFileExtension(file.name);

                    // MIMEタイプが空の場合は拡張子から推測
                    if (!mimeType) {
                        if (extension.toLowerCase() === 'jpg' || extension.toLowerCase() === 'jpeg') {
                            mimeType = 'image/jpeg';
                        } else if (extension.toLowerCase() === 'png') {
                            mimeType = 'image/png';
                        } else if (extension.toLowerCase() === 'gif') {
                            mimeType = 'image/gif';
                        } else if (extension.toLowerCase() === 'webp') {
                            mimeType = 'image/webp';
                        } else {
                            mimeType = 'image/jpeg'; // デフォルト
                            extension = 'jpg';
                        }
                    }

                    if (outputFormat === 'webp') {
                        mimeType = 'image/webp';
                        extension = 'webp';
                        quality = 0.85; // WebP効率的な品質
                    } else if (mimeType === 'image/jpeg' || mimeType === 'image/jpg') {
                        quality = 0.8; // JPEG適度な圧縮
                    } else if (mimeType === 'image/png') {
                        // PNGは元の形式を維持
                        quality = 1.0; // PNG品質（ロスレス圧縮）
                    } else if (mimeType === 'image/gif') {
                        // GIFも元の形式を維持
                        quality = 1.0;
                    } else if (mimeType === 'image/webp') {
                        // WebPも元の形式を維持
                        quality = 0.85;
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
        
        this.processedImages.forEach((result) => {
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
        
        console.log('Download button clicked');
        downloadBtn.classList.add('c-button--loading');
        downloadBtn.disabled = true;
        downloadBtn.querySelector('.c-button__text').textContent = '準備中...';

        try {
            console.log('Loading JSZip...');
            const JSZip = await this.loadJSZip();
            console.log('JSZip loaded, creating zip instance');
            const zip = new JSZip();

            const successfulImages = this.processedImages.filter(img => !img.error);
            console.log(`Adding ${successfulImages.length} files to zip`);

            if (successfulImages.length === 0) {
                throw new Error('圧縮済みファイルがありません');
            }

            // 圧縮済み画像のみを追加
            successfulImages.forEach((result, index) => {
                console.log(`Adding file ${index + 1}: ${result.fileName}`);
                zip.file(result.fileName, result.compressedBlob);
            });

            downloadBtn.querySelector('.c-button__text').textContent = 'ZIP作成中...';
            console.log('Generating ZIP file...');
            const content = await zip.generateAsync({ 
                type: 'blob',
                compression: 'DEFLATE',
                compressionOptions: { level: 6 }
            });
            
            console.log('ZIP file generated, size:', content.size);
            
            const now = new Date();
            const timestamp = now.toISOString().slice(0, 19).replace(/[-:T]/g, '').slice(0, 14);
            const filename = `compressed_images_${timestamp}.zip`;

            downloadBtn.querySelector('.c-button__text').textContent = 'ダウンロード開始...';
            
            const link = document.createElement('a');
            link.href = URL.createObjectURL(content);
            link.download = filename;
            link.style.display = 'none';
            
            document.body.appendChild(link);
            console.log('Triggering download...');
            link.click();
            
            // クリーンアップを少し遅らせる
            setTimeout(() => {
                document.body.removeChild(link);
                URL.revokeObjectURL(link.href);
            }, 100);

            this.showAlert(`${successfulImages.length}個のファイルをダウンロードしました`, 'success');
            console.log('Download completed successfully');
        } catch (error) {
            console.error('ZIP creation error:', error);
            this.showAlert(`ZIPファイルの作成に失敗しました: ${error.message}`, 'error');
        } finally {
            downloadBtn.classList.remove('c-button--loading');
            downloadBtn.disabled = false;
            downloadBtn.querySelector('.c-button__text').textContent = originalText;
        }
    }

    async loadJSZip() {
        if (window.JSZip) {
            console.log('JSZip already loaded');
            return Promise.resolve(window.JSZip);
        }

        console.log('Loading JSZip library...');
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
            script.crossOrigin = 'anonymous';
            
            script.onload = () => {
                console.log('JSZip loaded successfully');
                if (window.JSZip) {
                    resolve(window.JSZip);
                } else {
                    reject(new Error('JSZip is not available after loading'));
                }
            };
            
            script.onerror = (error) => {
                console.error('JSZip loading error:', error);
                reject(new Error('JSZip library could not be loaded'));
            };
            
            document.head.appendChild(script);
        });
    }



    isImageFile(file) {
        // セキュリティ強化: 安全な画像形式のみ許可
        const fileName = file.name.toLowerCase();
        const safeImageExtensions = [
            '.jpg', '.jpeg', '.png', '.gif', '.bmp', '.tiff', '.tif', '.webp'
            // SVG、ICOは XSS リスクのため除外
            // HEIC、HEIFは未対応のため除外
        ];
        
        const safeMimeTypes = [
            'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 
            'image/bmp', 'image/tiff', 'image/webp'
            // image/svg+xml は XSS リスクのため除外
            // image/heic, image/heif は未対応のため除外
        ];
        
        const hasValidExtension = safeImageExtensions.some(ext => fileName.endsWith(ext));
        const hasValidMimeType = file.type && safeMimeTypes.includes(file.type.toLowerCase());
        
        // ファイルサイズの事前チェック（DoS対策）
        const maxFileSize = 50 * 1024 * 1024; // 50MB
        if (file.size > maxFileSize) {
            console.warn(`File ${file.name} exceeds maximum size limit`);
            return false;
        }
        
        // デバッグ情報をコンソールに出力
        console.log(`Security Check - File: ${file.name}, Size: ${(file.size/1024/1024).toFixed(2)}MB, Type: "${file.type}", Extension: ${hasValidExtension ? 'OK' : 'NG'}, MIME: ${hasValidMimeType ? 'OK' : 'NG'}`);
        
        // より厳格な検証: 拡張子とMIMEタイプの両方が一致する必要
        return hasValidExtension && (hasValidMimeType || !file.type);
    }

    isHeicFile(file) {
        const fileName = file.name.toLowerCase();
        const isHeicExtension = fileName.endsWith('.heic') || fileName.endsWith('.heif');
        const isHeicMime = file.type === 'image/heic' || 
                          file.type === 'image/heif' ||
                          file.type === 'image/x-heic' ||
                          file.type === 'image/x-heif';
        
        const result = isHeicExtension || isHeicMime;
        
        if (result) {
            console.log(`HEIC file detected: ${file.name}, type: ${file.type}, size: ${file.size}`);
        }
        
        return result;
    }

    // DataTransferItemsを使ったフォルダの再帰的な走査
    async traverseDataTransferItems(items, files) {
        const promises = [];
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            if (item.webkitGetAsEntry) {
                const entry = item.webkitGetAsEntry();
                if (entry) {
                    promises.push(this.readEntry(entry, files));
                }
            } else if (item.getAsFile) {
                // フォールバック
                const file = item.getAsFile();
                if (file) files.push(file);
            }
        }
        await Promise.all(promises);
    }

    // エントリを再帰的に読み取り
    async readEntry(entry, files) {
        if (entry.isFile) {
            return new Promise((resolve) => {
                entry.file((file) => {
                    files.push(file);
                    resolve();
                });
            });
        } else if (entry.isDirectory) {
            const reader = entry.createReader();
            await this.readDirectory(reader, files);
        }
    }

    // ディレクトリの内容を再帰的に読み取り
    async readDirectory(reader, files) {
        const readBatch = () => {
            return new Promise((resolve) => {
                reader.readEntries(async (entries) => {
                    if (entries.length === 0) {
                        resolve();
                        return;
                    }
                    
                    const promises = entries.map(entry => this.readEntry(entry, files));
                    await Promise.all(promises);
                    
                    // 次のバッチを読み取り（ディレクトリが大きい場合のため）
                    await readBatch();
                    resolve();
                });
            });
        };
        
        await readBatch();
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

    updateProgress(total, completed) {
        const progressBar = document.getElementById('progressBar');
        const progressText = document.getElementById('progressText');
        const progressPercent = document.getElementById('progressPercent');
        
        const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
        
        if (progressBar) progressBar.style.width = `${percentage}%`;
        if (progressText) progressText.textContent = `${completed} / ${total}`;
        if (progressPercent) progressPercent.textContent = `${percentage}%`;
    }
    
    updateLoadingText(text) {
        const subtitle = document.getElementById('loadingSubtitle');
        if (subtitle) subtitle.textContent = text;
    }

    showLoading() {
        document.getElementById('loadingIndicator').classList.remove('u-display-none');
        this.updateLoadingText('しばらくお待ちください');
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