import { TimelineState } from '../core/TaskModel';

export class ExportManager {
	private resolveCssVariables(svgElement: SVGSVGElement): SVGSVGElement {
		const clone = svgElement.cloneNode(true) as SVGSVGElement;
		const computedStyle = getComputedStyle(document.body);

		const resolveVarInString = (str: string): string => {
			return str.replace(/var\(--([^)]+)\)/g, (match, varName) => {
				const value = computedStyle.getPropertyValue(`--${varName}`).trim();
				return value || match;
			});
		};

		const processElement = (element: Element): void => {
			const attrs = ['fill', 'stroke', 'color', 'stop-color', 'flood-color', 'lighting-color'];
			for (const attr of attrs) {
				const value = element.getAttribute(attr);
				if (value && value.includes('var(')) {
					element.setAttribute(attr, resolveVarInString(value));
				}
			}

			const style = element.getAttribute('style');
			if (style && style.includes('var(')) {
				element.setAttribute('style', resolveVarInString(style));
			}

			for (const child of Array.from(element.children)) {
				processElement(child);
			}
		};

		processElement(clone);
		return clone;
	}

	async exportToPNG(svgElement: SVGSVGElement, filename: string): Promise<void> {
		const resolvedSvg = this.resolveCssVariables(svgElement);
		const svgData = new XMLSerializer().serializeToString(resolvedSvg);
		const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
		const svgUrl = URL.createObjectURL(svgBlob);

		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext('2d');
		const img = new Image();

		return new Promise((resolve, reject) => {
			img.onload = () => {
				canvas.width = img.width * 2;
				canvas.height = img.height * 2;
				ctx!.scale(2, 2);

				const bgColor = getComputedStyle(document.body).getPropertyValue('--background-primary').trim() || '#ffffff';
				ctx!.fillStyle = bgColor;
				ctx!.fillRect(0, 0, canvas.width, canvas.height);

				ctx!.drawImage(img, 0, 0);

				canvas.toBlob((blob) => {
					if (!blob) {
						reject(new Error('Failed to create blob'));
						return;
					}

					const url = URL.createObjectURL(blob);
					const a = document.createElement('a');
					a.href = url;
					a.download = `${filename}.png`;
					document.body.appendChild(a);
					a.click();
					document.body.removeChild(a);
					URL.revokeObjectURL(url);
					URL.revokeObjectURL(svgUrl);
					resolve();
				}, 'image/png');
			};

			img.onerror = () => {
				URL.revokeObjectURL(svgUrl);
				reject(new Error('Failed to load SVG'));
			};

			img.src = svgUrl;
		});
	}

	async exportToPDF(svgElement: SVGSVGElement, filename: string): Promise<void> {
		const resolvedSvg = this.resolveCssVariables(svgElement);
		const svgData = new XMLSerializer().serializeToString(resolvedSvg);
		const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
		const svgUrl = URL.createObjectURL(svgBlob);

		const canvas = document.createElement('canvas');
		const ctx = canvas.getContext('2d');
		const img = new Image();

		return new Promise((resolve, reject) => {
			img.onload = () => {
				const width = img.width;
				const height = img.height;

				canvas.width = width * 2;
				canvas.height = height * 2;
				ctx!.scale(2, 2);

				const bgColor = getComputedStyle(document.body).getPropertyValue('--background-primary').trim() || '#ffffff';
				ctx!.fillStyle = bgColor;
				ctx!.fillRect(0, 0, canvas.width, canvas.height);

				ctx!.drawImage(img, 0, 0);

				const dataUrl = canvas.toDataURL('image/png');

				// Create a Blob with HTML content and open it
				const htmlContent = `<!DOCTYPE html>
<html>
<head>
	<title>${filename}</title>
	<style>
		@page {
			size: ${width}px ${height}px;
			margin: 0;
		}
		body {
			margin: 0;
			padding: 0;
		}
		img {
			width: 100%;
			height: auto;
		}
	</style>
</head>
<body>
	<img src="${dataUrl}" />
	<script>
		window.onload = function() {
			window.print();
			window.close();
		};
	</script>
</body>
</html>`;

				const htmlBlob = new Blob([htmlContent], { type: 'text/html' });
				const htmlUrl = URL.createObjectURL(htmlBlob);

				window.open(htmlUrl, '_blank');

				// Clean up after a delay to allow the window to open
				setTimeout(() => {
					URL.revokeObjectURL(htmlUrl);
				}, 1000);

				URL.revokeObjectURL(svgUrl);
				resolve();
			};

			img.onerror = () => {
				URL.revokeObjectURL(svgUrl);
				reject(new Error('Failed to load SVG'));
			};

			img.src = svgUrl;
		});
	}

	generateFilename(state: TimelineState): string {
		const date = new Date().toISOString().split('T')[0];
		const projectNames = state.projects.map(p => p.name).join('-').substring(0, 30);
		return `timeline-${projectNames}-${date}`.replace(/[^a-zA-Z0-9-]/g, '_');
	}
}

export const exportManager = new ExportManager();
