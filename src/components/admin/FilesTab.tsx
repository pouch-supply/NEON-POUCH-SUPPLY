import React from 'react';
import { Search, HardDrive, Download, Upload, Plus, Trash2 } from 'lucide-react';
import { FileEntry } from '../../types';
import { renderMediaThumbnail } from '../ImageUploadInput';

interface FilesTabProps {
  fileQuery: string;
  setFileQuery: (val: string) => void;
  filteredFiles: FileEntry[];
  selectedFileIds: string[];
  handleExportFiles: () => void;
  handleImportFiles: (e: React.ChangeEvent<HTMLInputElement>) => void;
  fileManagerInputRef: React.RefObject<HTMLInputElement>;
  handleDirectDeviceFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSelectAllFiles: (checked: boolean) => void;
  handleBulkDeleteFiles: () => void;
  handleSelectFile: (id: string, checked: boolean) => void;
  handleDeleteFile: (id: string) => void;
}

export const FilesTab: React.FC<FilesTabProps> = ({
  fileQuery,
  setFileQuery,
  filteredFiles,
  selectedFileIds,
  handleExportFiles,
  handleImportFiles,
  fileManagerInputRef,
  handleDirectDeviceFileUpload,
  handleSelectAllFiles,
  handleBulkDeleteFiles,
  handleSelectFile,
  handleDeleteFile,
}) => {
  return (
    <div className="space-y-6">
      
      {/* Header controls filter */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3 bg-white border border-slate-200 p-4 rounded-xl shadow-xs">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              placeholder="Filter media files..."
              value={fileQuery}
              onChange={(e) => setFileQuery(e.target.value)}
              className="w-full text-xs p-2 pb-2 pl-8 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-slate-500 bg-slate-50"
            />
            <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
          </div>
          <div className="px-3 py-1.5 bg-slate-100 rounded-lg text-slate-600 text-xs font-bold whitespace-nowrap self-start sm:self-auto flex items-center gap-1.5 border border-slate-150">
            <HardDrive className="h-3.5 w-3.5 text-slate-500" />
            <span>{filteredFiles.length} media files on list</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-end">
          <button
            onClick={handleExportFiles}
            className="bg-white hover:bg-slate-50 border border-slate-200 font-bold p-2.5 px-3 rounded-xl text-xs text-slate-700 flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
            title="Export all media files list to JSON backup file"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" /> Export Backup
          </button>

          <label
            className="bg-white hover:bg-slate-50 border border-slate-200 font-bold p-2.5 px-3 rounded-xl text-xs text-slate-700 flex items-center gap-1.5 transition cursor-pointer shadow-2xs"
            title="Import media files from JSON backup"
          >
            <Upload className="h-3.5 w-3.5 text-slate-500" /> Import Backup
            <input
              type="file"
              accept=".json"
              className="hidden"
              onChange={handleImportFiles}
            />
          </label>

          <button
            onClick={() => fileManagerInputRef.current?.click()}
            className="bg-slate-900 hover:bg-slate-850 text-white font-bold text-xs p-2.5 px-4 rounded-xl flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Upload File
          </button>
          <input
            ref={fileManagerInputRef}
            type="file"
            multiple
            accept="image/*,video/*,.pdf,.doc,.docx,.csv,.xlsx,.zip,.txt"
            className="hidden"
            onChange={handleDirectDeviceFileUpload}
          />
        </div>
      </div>

      {/* List files layout table */}
      <div className="bg-white border rounded-xl overflow-hidden shadow-xs">
        {/* Bulk Actions Bar for Files */}
        {selectedFileIds.length > 0 && (
          <div className="bg-slate-50 border-b border-slate-200 p-3 px-4 flex flex-wrap items-center justify-between gap-2 animate-fadeIn">
            <div className="flex items-center gap-3">
              <input 
                type="checkbox"
                className="rounded border-slate-300 text-slate-900 focus:ring-slate-500 h-4 w-4 cursor-pointer"
                checked={filteredFiles.length > 0 && filteredFiles.every(f => selectedFileIds.includes(f.id))}
                onChange={(e) => handleSelectAllFiles(e.target.checked)}
              />
              <span className="text-xs font-bold text-slate-700">
                {selectedFileIds.length} selected <span className="text-slate-400 font-normal">({filteredFiles.length} total on list)</span>
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleBulkDeleteFiles}
                className="px-3 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg text-xs font-extrabold text-red-650 transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete bulk
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50/75 border-b border-slate-200 text-[10px] text-slate-450 font-bold uppercase tracking-widest">
                <th className="p-4 w-12 text-center">
                  <input 
                    type="checkbox"
                    className="rounded border-slate-300 text-slate-900 focus:ring-slate-500 h-4 w-4 cursor-pointer"
                    checked={filteredFiles.length > 0 && filteredFiles.every(f => selectedFileIds.includes(f.id))}
                    onChange={(e) => handleSelectAllFiles(e.target.checked)}
                  />
                </th>
                <th className="p-4">Media Thumbnail</th>
                <th className="p-4">File Name</th>
                <th className="p-4">Alternative Alt Text</th>
                <th className="p-4">Date Uploaded</th>
                <th className="p-4">Size</th>
                <th className="p-4">Linked Reference</th>
                <th className="p-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredFiles.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">No media assets configured.</td>
                </tr>
              ) : (
                filteredFiles.map(file => (
                  <tr key={file.id} className="hover:bg-slate-50/50">
                    <td className="p-4 w-12 text-center">
                      <input 
                        type="checkbox"
                        className="rounded border-slate-300 text-slate-900 focus:ring-slate-500 h-4 w-4 cursor-pointer"
                        checked={selectedFileIds.includes(file.id)}
                        onChange={(e) => handleSelectFile(file.id, e.target.checked)}
                      />
                    </td>
                    <td className="p-4 shrink-0">
                      <div className="w-12 h-12 rounded-md overflow-hidden bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0">
                        {renderMediaThumbnail(file.url, file.fileName, file.mimeType, "w-full h-full")}
                      </div>
                    </td>
                    <td className="p-4 text-slate-905 max-w-xs font-mono font-bold leading-normal text-[11px] truncate">{file.fileName}</td>
                    <td className="p-4 text-slate-500 max-w-xs truncate">{file.altText}</td>
                    <td className="p-4 text-slate-400">{file.dateAdded}</td>
                    <td className="p-4 font-semibold text-slate-700">{file.size}</td>
                    <td className="p-4 text-indigo-600 font-bold">{file.references}</td>
                    <td className="p-4 text-center">
                      <button
                        onClick={() => handleDeleteFile(file.id)}
                        className="text-red-500 hover:text-red-700 font-extrabold cursor-pointer"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

export default FilesTab;
