import { Component, signal, computed, ElementRef, ViewChild, AfterViewInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

interface CellPosition {
  row: number;
  col: number;
}

interface MergedRegion {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
  rowSpan: number;
  colSpan: number;
}

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements AfterViewInit {
  @ViewChild('gridContainer', { static: false }) gridContainer!: ElementRef;

  gridSize = signal(3);
  cells = computed(() => {
    const size = this.gridSize();
    const result = [];
    for (let row = 0; row < size; row++) {
      for (let col = 0; col < size; col++) {
        result.push({ row, col, id: `cell-${row}-${col}` });
      }
    }
    return result;
  });

  mergedRegions: MergedRegion[] = [];
  skipMap = new Set<string>();
  selectedCells = new Set<string>();
  generatedCode = '';
  displayedCode = '';
  isTyping = false;
  
  private isDragging = false;
  private startCell: CellPosition | null = null;
  currentSelection: CellPosition[] = [];

  ngAfterViewInit() {
    this.disableTextSelection();
  }

  private disableTextSelection() {
    if (this.gridContainer) {
      const element = this.gridContainer.nativeElement;
      element.style.userSelect = 'none';
      element.style.webkitUserSelect = 'none';
      element.style.mozUserSelect = 'none';
      element.style.msUserSelect = 'none';
      element.addEventListener('dragstart', (e: Event) => e.preventDefault());
      element.addEventListener('selectstart', (e: Event) => e.preventDefault());
    }
  }

  buildGrid() {
    const size = this.gridSize();
    if (size >= 1) {
      this.reset();
    }
  }

  onCellMouseDown(event: MouseEvent, row: number, col: number) {
    event.preventDefault();
    this.isDragging = true;
    this.startCell = { row, col };
    this.selectedCells.clear();
    this.selectedCells.add(`${row}-${col}`);
    this.currentSelection = [{ row, col }];
  }

  onCellMouseEnter(row: number, col: number) {
    if (!this.isDragging || !this.startCell) return;

    const minRow = Math.min(this.startCell.row, row);
    const maxRow = Math.max(this.startCell.row, row);
    const minCol = Math.min(this.startCell.col, col);
    const maxCol = Math.max(this.startCell.col, col);

    this.selectedCells.clear();
    this.currentSelection = [];

    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        this.selectedCells.add(`${r}-${c}`);
        this.currentSelection.push({ row: r, col: c });
      }
    }
  }

  @HostListener('document:mouseup')
  onMouseUp() {
    this.isDragging = false;
    this.startCell = null;
  }

  mergeSelection() {
    if (this.currentSelection.length === 0) return;

    const positions = this.currentSelection;
    const minRow = Math.min(...positions.map(p => p.row));
    const maxRow = Math.max(...positions.map(p => p.row));
    const minCol = Math.min(...positions.map(p => p.col));
    const maxCol = Math.max(...positions.map(p => p.col));

    const expectedCells = (maxRow - minRow + 1) * (maxCol - minCol + 1);
    if (positions.length !== expectedCells) {
      alert('Please select a rectangular area');
      return;
    }

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        const cellKey = `${row}-${col}`;
        if (this.skipMap.has(cellKey)) {
          alert('Selection overlaps with existing merged area');
          return;
        }
      }
    }

    const newRegion: MergedRegion = {
      startRow: minRow,
      startCol: minCol,
      endRow: maxRow,
      endCol: maxCol,
      rowSpan: maxRow - minRow + 1,
      colSpan: maxCol - minCol + 1
    };

    this.mergedRegions.push(newRegion);

    for (let row = minRow; row <= maxRow; row++) {
      for (let col = minCol; col <= maxCol; col++) {
        if (row !== minRow || col !== minCol) {
          this.skipMap.add(`${row}-${col}`);
        }
      }
    }

    this.selectedCells.clear();
    this.currentSelection = [];
  }

  reset() {
    this.mergedRegions = [];
    this.skipMap.clear();
    this.selectedCells.clear();
    this.currentSelection = [];
    this.generatedCode = '';
    this.displayedCode = '';
    this.isTyping = false;
  }

  generateCode() {
    const size = this.gridSize();
    let html = '<table class="merged">\n';

    for (let row = 0; row < size; row++) {
      html += '  <tr>\n';
      for (let col = 0; col < size; col++) {
        const cellKey = `${row}-${col}`;
        if (this.skipMap.has(cellKey)) {
          continue;
        }

        const region = this.mergedRegions.find(r => 
          r.startRow === row && r.startCol === col
        );

        if (region) {
          html += `    <td colspan="${region.colSpan}" rowspan="${region.rowSpan}"></td>\n`;
        } else {
          html += '    <td></td>\n';
        }
      }
      html += '  </tr>\n';
    }

    html += '</table>';

    const css = `<style>
.merged {
  border-collapse: collapse;
}
.merged td {
  border: 1px solid #000;
  background: #fff;
  width: 40px;
  height: 40px;
}
</style>`;

    const fullHtml = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Generated Table</title>
  ${css}
</head>
<body>
  ${html}
</body>
</html>`;

    this.generatedCode = fullHtml;
    this.startTypewriterAnimation(fullHtml);
  }

  saveCode() {
    if (this.generatedCode) {
      this.downloadCode(this.generatedCode);
    }
  }

  private startTypewriterAnimation(content: string) {
    this.displayedCode = '';
    this.isTyping = true;
    let index = 0;
    const baseSpeed = 15;
    
    const typeNextChar = () => {
      if (index < content.length) {
        const char = content.charAt(index);
        this.displayedCode += char;
        index++;
        
        let speed = baseSpeed;
        if (char === '\n') {
          speed = baseSpeed * 2;
        } else if (char === ' ') {
          speed = baseSpeed * 0.5;
        } else if ('<>=/"'.includes(char)) {
          speed = baseSpeed * 0.8;
        }
        
        setTimeout(typeNextChar, speed);
      } else {
        this.isTyping = false;
      }
    };

    setTimeout(typeNextChar, 300);
  }

  private downloadCode(content: string) {
    const blob = new Blob([content], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'generated-table.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  getCellClass(row: number, col: number): string {
    const cellKey = `${row}-${col}`;
    let classes = ['cell'];
    
    if (this.skipMap.has(cellKey)) {
      classes.push('skip');
      return classes.join(' ');
    }
    
    const region = this.mergedRegions.find(r => 
      row >= r.startRow && row <= r.endRow && 
      col >= r.startCol && col <= r.endCol
    );
    
    if (region) {
      classes.push('merged');
    }
    
    if (this.selectedCells.has(cellKey)) {
      classes.push('selected');
    }
    
    return classes.join(' ');
  }

  isCellVisible(row: number, col: number): boolean {
    const cellKey = `${row}-${col}`;
    return !this.skipMap.has(cellKey);
  }
}
