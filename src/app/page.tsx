"use client";

import { useState, useEffect, useCallback } from "react";

interface Job {
  _id: string;
  title: string;
  description: string;
  clientName: string;
  platform: string;
  jobLink: string;
  budget: string;
  postedTime: string;
  requiredTools: string;
  relevanceReason: string;
  urgency: string;
  fitScore: number;
  serviceCategory: string;
  uploadedAt: string;
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loadingJobs, setLoadingJobs] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [sheetUrl, setSheetUrl] = useState("");
  const [serviceAccountFile, setServiceAccountFile] = useState<File | null>(null);
  const [sheetsUploading, setSheetsUploading] = useState(false);
  const [autoSync, setAutoSync] = useState(false);

  const fetchJobs = useCallback(async () => {
    setLoadingJobs(true);
    try {
      const res = await fetch("/api/jobs");
      const data = await res.json();
      if (data.jobs) {
        setJobs(data.jobs);
      }
    } catch (err) {
      console.error("Failed to fetch jobs", err);
    } finally {
      setLoadingJobs(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleUpload = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!file) {
      setMessage("Please select a file");
      return;
    }

    setUploading(true);
    setMessage("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.success) {
        setMessage(
          `Extracted ${data.extracted} jobs. Inserted ${data.inserted} new. ${data.duplicates} duplicates skipped.`
        );
        fetchJobs();
        setFile(null);
        if (autoSync && sheetUrl && serviceAccountFile) {
          setTimeout(() => handleSheetsUpload(), 500);
        }
      } else {
        setMessage(data.error || "Something went wrong");
      }
    } catch (err: any) {
      setMessage(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      if (!droppedFile.name.endsWith(".html") && !droppedFile.name.endsWith(".htm")) {
        setMessage("Only HTML files are allowed");
        return;
      }
      setFile(droppedFile);
      setMessage("");
    }
  };

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch("/api/export");
      if (!res.ok) {
        const data = await res.json();
        setMessage(data.error || "Export failed");
        return;
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "plugwheel_jobs.xlsx";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err: any) {
      setMessage(err.message || "Download failed");
    } finally {
      setDownloading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this job?")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`/api/jobs/${id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setJobs((prev) => prev.filter((j) => j._id !== id));
      } else {
        setMessage(data.error || "Delete failed");
      }
    } catch (err: any) {
      setMessage(err.message || "Delete failed");
    } finally {
      setDeletingId(null);
    }
  };

  const handleSheetsUpload = async () => {
    if (!sheetUrl.trim()) {
      setMessage("Please enter a Google Sheet URL");
      return;
    }
    if (!serviceAccountFile) {
      setMessage("Please upload the Service Account JSON file");
      return;
    }

    setSheetsUploading(true);
    setMessage("");

    const formData = new FormData();
    formData.append("sheetUrl", sheetUrl);
    formData.append("serviceAccount", serviceAccountFile);

    try {
      const res = await fetch("/api/sheets", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();

      if (data.success) {
        setMessage(`Uploaded ${data.uploaded} jobs to Google Sheets successfully!`);
      } else {
        setMessage(data.error || "Google Sheets upload failed");
      }
    } catch (err: any) {
      setMessage(err.message || "Google Sheets upload failed");
    } finally {
      setSheetsUploading(false);
    }
  };

  const urgencyColor = (urgency: string) => {
    switch (urgency) {
      case "High":
        return "bg-red-100 text-red-700";
      case "Medium":
        return "bg-yellow-100 text-yellow-700";
      case "Low":
        return "bg-green-100 text-green-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  const fitScoreColor = (score: number) => {
    if (score >= 8) return "text-green-600 font-bold";
    if (score >= 5) return "text-yellow-600 font-semibold";
    return "text-gray-500";
  };

  return (
    <main className="flex-1 container mx-auto px-4 py-8 max-w-[90rem]">
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
        <h1 className="text-2xl font-bold mb-2 text-gray-800">
          PlugWheel Job Extractor
        </h1>
        <p className="text-gray-600 mb-6">
          Upload Upwork HTML files to extract automation-related job listings.
          Only jobs matching PlugWheel&apos;s service focus are saved.
        </p>

        <form onSubmit={handleUpload}>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer ${
              dragOver
                ? "border-blue-500 bg-blue-50"
                : "border-gray-300 hover:border-gray-400 bg-gray-50"
            }`}
            onClick={() => document.getElementById("fileInput")?.click()}
          >
            <input
              id="fileInput"
              type="file"
              accept=".html,.htm"
              className="hidden"
              onChange={(e) => {
                const selected = e.target.files?.[0] || null;
                if (selected) {
                  setFile(selected);
                  setMessage("");
                }
              }}
            />
            <div className="flex flex-col items-center gap-2">
              <svg
                className="w-10 h-10 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M12 16.5V9.75m0 0-3 3m3-3 3 3M6.75 19.5h10.5a2.25 2.25 0 0 0 2.25-2.25V6.75a2.25 2.25 0 0 0-2.25-2.25H6.75A2.25 2.25 0 0 0 4.5 6.75v10.5a2.25 2.25 0 0 0 2.25 2.25Z"
                />
              </svg>
              {file ? (
                <div>
                  <p className="text-sm font-medium text-gray-800">{file.name}</p>
                  <p className="text-xs text-gray-500">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-sm font-medium text-gray-700">
                    Drag & drop your HTML file here
                  </p>
                  <p className="text-xs text-gray-500">
                    or click to browse (.html, .htm)
                  </p>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-3 mt-4">
            <button
              type="submit"
              disabled={uploading || !file}
              className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {uploading ? "Extracting..." : "Upload & Extract"}
            </button>
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              disabled={jobs.length === 0}
              className="px-6 py-2.5 bg-purple-600 text-white rounded-lg font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Preview Excel
            </button>
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading || jobs.length === 0}
              className="px-6 py-2.5 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {downloading ? "Preparing..." : "Download Excel"}
            </button>
            {file && (
              <button
                type="button"
                onClick={() => setFile(null)}
                className="px-4 py-2.5 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium"
              >
                Clear file
              </button>
            )}
          </div>
        </form>

        {message && (
          <div
            className={`mt-4 p-3 rounded-lg text-sm ${
              message.includes("failed") || message.includes("error")
                ? "bg-red-50 text-red-700 border border-red-200"
                : "bg-green-50 text-green-700 border border-green-200"
            }`}
          >
            {message}
          </div>
        )}

        {/* Google Sheets Upload */}
        <div className="mt-6 border-t border-gray-200 pt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">
              Upload to Google Sheets
            </h3>
            <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
              <input
                type="checkbox"
                checked={autoSync}
                onChange={(e) => setAutoSync(e.target.checked)}
                className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              Auto-sync after extract
            </label>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              placeholder="Paste Google Sheet URL here"
              value={sheetUrl}
              onChange={(e) => setSheetUrl(e.target.value)}
              className="flex-1 px-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            />
            <label className="cursor-pointer">
              <input
                type="file"
                accept=".json"
                className="hidden"
                onChange={(e) =>
                  setServiceAccountFile(e.target.files?.[0] || null)
                }
              />
              <span
                className={`inline-block px-4 py-2.5 border rounded-lg text-sm font-medium ${
                  serviceAccountFile
                    ? "border-green-300 bg-green-50 text-green-700"
                    : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
                }`}
              >
                {serviceAccountFile
                  ? "JSON loaded ✓"
                  : "Service Account JSON"}
              </span>
            </label>
            <button
              type="button"
              onClick={handleSheetsUpload}
              disabled={sheetsUploading || jobs.length === 0}
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
            >
              {sheetsUploading
                ? "Uploading..."
                : "Upload to Google Sheet"}
            </button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">
            Stored Jobs ({jobs.length})
          </h2>
          <button
            onClick={fetchJobs}
            disabled={loadingJobs}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium disabled:opacity-50"
          >
            {loadingJobs ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {jobs.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            {loadingJobs ? (
              "Loading jobs..."
            ) : (
              <>
                <p className="text-lg font-medium mb-1">No jobs yet</p>
                <p className="text-sm">
                  Upload an Upwork HTML file to get started.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-gray-50 text-gray-700 font-semibold">
                <tr>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Description</th>
                  <th className="px-4 py-3">Client</th>
                  <th className="px-4 py-3">Budget</th>
                  <th className="px-4 py-3">Posted</th>
                  <th className="px-4 py-3">Added</th>
                  <th className="px-4 py-3">Tools</th>
                  <th className="px-4 py-3">Urgency</th>
                  <th className="px-4 py-3">Fit</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Link</th>
                  <th className="px-4 py-3">Reason</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {jobs.map((job) => (
                  <tr key={job._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate" title={job.title}>
                      {job.title}
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-md">
                      <div className="line-clamp-3 text-xs">{job.description || "—"}</div>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {job.clientName || "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                      {job.budget || "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                      {job.postedTime || "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                      {new Date(job.uploadedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs truncate text-xs" title={job.requiredTools}>
                      {job.requiredTools || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${urgencyColor(job.urgency)}`}>
                        {job.urgency || "Medium"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-sm ${fitScoreColor(job.fitScore)}`}>
                        {job.fitScore || "—"}/10
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
                      {job.serviceCategory || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={job.jobLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 hover:underline truncate max-w-[120px] inline-block text-xs"
                      >
                        Link
                      </a>
                    </td>
                    <td className="px-4 py-3 text-gray-600 max-w-xs text-xs" title={job.relevanceReason}>
                      <div className="line-clamp-2">
                        {job.relevanceReason || "—"}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDelete(job._id)}
                        disabled={deletingId === job._id}
                        className="text-red-600 hover:text-red-800 text-sm font-medium disabled:opacity-50"
                      >
                        {deletingId === job._id ? "..." : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Excel Preview Modal */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-[90rem] max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-800">
                Excel Preview ({jobs.length} rows)
              </h3>
              <button
                onClick={() => setShowPreview(false)}
                className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
              >
                &times;
              </button>
            </div>
            <div className="overflow-auto flex-1 p-0">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-100 text-gray-700 font-semibold sticky top-0">
                  <tr>
                    <th className="px-4 py-3 border-b">Title</th>
                    <th className="px-4 py-3 border-b">Description</th>
                    <th className="px-4 py-3 border-b">Client</th>
                    <th className="px-4 py-3 border-b">Platform</th>
                    <th className="px-4 py-3 border-b">Budget</th>
                    <th className="px-4 py-3 border-b">Posted</th>
                    <th className="px-4 py-3 border-b">Tools</th>
                    <th className="px-4 py-3 border-b">Urgency</th>
                    <th className="px-4 py-3 border-b">Fit</th>
                    <th className="px-4 py-3 border-b">Category</th>
                    <th className="px-4 py-3 border-b">Link</th>
                    <th className="px-4 py-3 border-b">Reason</th>
                    <th className="px-4 py-3 border-b">Uploaded</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {jobs.map((job) => (
                    <tr key={job._id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-900 max-w-xs truncate">
                        {job.title}
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-sm">
                        <div className="line-clamp-3 text-xs">{job.description || "—"}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                        {job.clientName || "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
                        {job.platform || "Upwork"}
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
                        {job.budget || "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                        {job.postedTime || "—"}
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-xs truncate text-xs">
                        {job.requiredTools || "—"}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${urgencyColor(job.urgency)}`}>
                          {job.urgency || "Medium"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <span className={fitScoreColor(job.fitScore)}>
                          {job.fitScore || "—"}/10
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap text-xs">
                        {job.serviceCategory || "—"}
                      </td>
                      <td className="px-4 py-3 text-blue-600 truncate max-w-[120px] text-xs">
                        {job.jobLink}
                      </td>
                      <td className="px-4 py-3 text-gray-600 max-w-xs text-xs">
                        <div className="line-clamp-2">{job.relevanceReason || "—"}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap text-xs">
                        {new Date(job.uploadedAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
              <button
                onClick={() => {
                  setShowPreview(false);
                  handleDownload();
                }}
                disabled={downloading}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
              >
                {downloading ? "Preparing..." : "Download Excel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
